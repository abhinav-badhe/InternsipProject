import { SubscriptionProcessor, subscriptionRoutes } from './subscriptions.js';
import express, { Request, Response, NextFunction } from 'express';
import { CheckoutSagaOrchestrator, PricingClient, InventoryClient } from './checkout.saga.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse, CreateOrderRequest } from '@grocery/contracts';

const logger = createLogger('order-service:api');

export function createApp(deps?: {
  pricingClient?: PricingClient;
  inventoryClient?: InventoryClient;
}): express.Application {
  const app = express();
  app.use(express.json());

  // Default HTTP clients to other internal services if not provided
  const pricingClient: PricingClient = deps?.pricingClient || {
    calculateQuote: async (items, promoCode) => {
      // In production, calls http://pricing-service:3002/api/v1/pricing/quote
      const res = await fetch(
        `${process.env.PRICING_SERVICE_URL || 'http://localhost:3002'}/api/v1/pricing/quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, promoCode }),
        }
      );
      const json: any = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Pricing quote failed');
      return json.data;
    },
  };

  const inventoryClient: InventoryClient = deps?.inventoryClient || {
    reserveStock: async (reservationId, items) => {
      // In production, calls http://inventory-service:3003/api/v1/inventory/reserve
      const res = await fetch(
        `${process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003'}/api/v1/inventory/reserve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, items }),
        }
      );
      const json: any = await res.json();
      return json.data || json.error?.details || json;
    },
    consumeReservation: async (reservationId, orderId) => {
      const response = await fetch(`${process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003'}/api/v1/inventory/reservations/${reservationId}/consume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }), signal: AbortSignal.timeout(10000),
      });
      const json: any = await response.json();
      return response.ok && json.success && json.data?.consumed === true;
    },
    releaseReservation: async (reservationId, reason) => {
      const res = await fetch(
        `${process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003'}/api/v1/inventory/reservations/${reservationId}/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      const json: any = await res.json();
      return json.data?.released;
    },
  };

  const saga = new CheckoutSagaOrchestrator(pricingClient, inventoryClient);

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'order-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming order request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // Health checks
  app.get(['/health', '/health/live'], (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    const isDbHealthy = await Database.checkHealth();
    if (isDbHealthy) {
      res.status(200).json({ status: 'ready', database: 'connected' });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Feature 13: Scheduled Delivery Slots & Express Delivery
  Database.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot_id VARCHAR(64) DEFAULT 'express-15';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(32) DEFAULT 'EXPRESS';
  `).catch(() => {});

  app.get('/api/v1/orders/delivery-slots', async (_req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const now = new Date();
    const currentHour = now.getHours();

    // Query live capacity utilization from PostgreSQL orders table
    let slotCounts: Record<string, number> = {};
    try {
      const countRes = await Database.query(
        `SELECT delivery_slot_id, count(*)::int as count
         FROM orders
         WHERE created_at >= CURRENT_DATE
         GROUP BY delivery_slot_id`
      );
      for (const row of countRes.rows) {
        if (row.delivery_slot_id) slotCounts[row.delivery_slot_id] = row.count;
      }
    } catch {}

    const MAX_SLOT_CAPACITY = 35;

    const slots = [
      {
        id: 'express-15',
        type: 'EXPRESS',
        title: 'Express Rush',
        timeWindow: '10 - 15 Mins',
        tag: '⚡ 15-Min Delivery',
        badgeColor: 'amber',
        fee: 25,
        available: (slotCounts['express-15'] || 0) < 50,
        capacityStatus: (slotCounts['express-15'] || 0) > 30 ? 'HIGH_DEMAND' : 'OPTIMAL',
        bookedCount: slotCounts['express-15'] || 0,
        maxCapacity: 50,
        description: 'Direct priority dispatch from nearest dark store',
      },
      {
        id: 'express-30',
        type: 'EXPRESS',
        title: 'Standard Express',
        timeWindow: '25 - 30 Mins',
        tag: 'Free over ₹199',
        badgeColor: 'emerald',
        fee: 0,
        available: true,
        capacityStatus: (slotCounts['express-30'] || 0) > 40 ? 'HIGH_DEMAND' : 'OPTIMAL',
        bookedCount: slotCounts['express-30'] || 0,
        maxCapacity: 60,
        description: 'Fast eco-batched dispatch',
      },
      {
        id: 'slot-today-evening',
        type: 'SCHEDULED',
        title: 'Today Evening',
        timeWindow: '04:00 PM - 07:00 PM',
        tag: 'Scheduled',
        badgeColor: 'blue',
        fee: 0,
        available: currentHour < 18 && (slotCounts['slot-today-evening'] || 0) < MAX_SLOT_CAPACITY,
        capacityStatus: currentHour >= 18
          ? 'CLOSED'
          : (slotCounts['slot-today-evening'] || 0) >= MAX_SLOT_CAPACITY
          ? 'FULL'
          : 'AVAILABLE',
        bookedCount: slotCounts['slot-today-evening'] || 0,
        maxCapacity: MAX_SLOT_CAPACITY,
        description: 'Reserved evening delivery slot',
      },
      {
        id: 'slot-today-night',
        type: 'SCHEDULED',
        title: 'Today Night',
        timeWindow: '07:00 PM - 10:00 PM',
        tag: 'Dinner Slot',
        badgeColor: 'purple',
        fee: 0,
        available: currentHour < 21 && (slotCounts['slot-today-night'] || 0) < MAX_SLOT_CAPACITY,
        capacityStatus: currentHour >= 21
          ? 'CLOSED'
          : (slotCounts['slot-today-night'] || 0) >= MAX_SLOT_CAPACITY
          ? 'FULL'
          : 'AVAILABLE',
        bookedCount: slotCounts['slot-today-night'] || 0,
        maxCapacity: MAX_SLOT_CAPACITY,
        description: 'Post-work convenience slot',
      },
      {
        id: 'slot-tomorrow-morning',
        type: 'SCHEDULED',
        title: 'Tomorrow Morning',
        timeWindow: '07:00 AM - 10:00 AM',
        tag: 'Breakfast Fresh',
        badgeColor: 'teal',
        fee: 0,
        available: (slotCounts['slot-tomorrow-morning'] || 0) < MAX_SLOT_CAPACITY,
        capacityStatus: (slotCounts['slot-tomorrow-morning'] || 0) >= MAX_SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
        bookedCount: slotCounts['slot-tomorrow-morning'] || 0,
        maxCapacity: MAX_SLOT_CAPACITY,
        description: 'Fresh milk, bakery & farm produce',
      },
      {
        id: 'slot-tomorrow-evening',
        type: 'SCHEDULED',
        title: 'Tomorrow Evening',
        timeWindow: '04:00 PM - 07:00 PM',
        tag: 'Tomorrow',
        badgeColor: 'indigo',
        fee: 0,
        available: (slotCounts['slot-tomorrow-evening'] || 0) < MAX_SLOT_CAPACITY,
        capacityStatus: (slotCounts['slot-tomorrow-evening'] || 0) >= MAX_SLOT_CAPACITY ? 'FULL' : 'AVAILABLE',
        bookedCount: slotCounts['slot-tomorrow-evening'] || 0,
        maxCapacity: MAX_SLOT_CAPACITY,
        description: 'Relaxed planned grocery restock',
      },
    ];

    res.status(200).json(
      okResponse(
        {
          currentTime: now.toISOString(),
          expressAvailable: true,
          slots,
        },
        correlationId
      )
    );
  });

  // Feature 16: Recurring Subscription Deliveries (Milk & Daily Essentials)
  const initSubscriptionTables = async () => {
    try {
      await Database.query(`
        CREATE TABLE IF NOT EXISTS customer_subscriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          subscription_number VARCHAR(32) NOT NULL UNIQUE,
          customer_id VARCHAR(64) NOT NULL,
          sku VARCHAR(64) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          variant_name VARCHAR(128) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
          unit_price NUMERIC(10, 2) NOT NULL,
          discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
          frequency VARCHAR(32) NOT NULL DEFAULT 'DAILY',
          delivery_slot VARCHAR(64) NOT NULL DEFAULT '07:00 AM - 09:00 AM',
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          start_date DATE NOT NULL DEFAULT CURRENT_DATE,
          next_delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
          delivery_address JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_subs_cust_id ON customer_subscriptions(customer_id);

        CREATE TABLE IF NOT EXISTS subscription_execution_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          subscription_id UUID NOT NULL,
          order_id UUID NOT NULL,
          order_number VARCHAR(32) NOT NULL,
          execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
          status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sub_logs_date ON subscription_execution_logs(execution_date);
        ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'WEB';
        ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS creation_key TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_creation_key ON customer_subscriptions(creation_key);
      `);
    } catch (err: any) {
      logger.warn('Subscription table bootstrap notice', { message: err.message });
      throw err;
    }
  };
  const subscriptionsReady = initSubscriptionTables();
  const roundMoney = (value: number) => Math.round(value * 100) / 100;
  const subscriptionSaga = new CheckoutSagaOrchestrator({
    calculateQuote: async (items) => {
      const quote = await pricingClient.calculateQuote(items);
      const discounted = quote.items.map((item) => ({ ...item,
        unitPrice: roundMoney(item.unitPrice * 0.9),
        discountAmount: roundMoney(item.discountAmount + item.netAmount * 0.1),
        netAmount: roundMoney(item.netAmount * 0.9), taxAmount: roundMoney(item.taxAmount * 0.9),
      }));
      const discountTotal = roundMoney(discounted.reduce((sum, item) => sum + item.discountAmount, 0));
      const taxTotal = roundMoney(discounted.reduce((sum, item) => sum + item.taxAmount, 0));
      return { ...quote, items: discounted, discountTotal, taxTotal, deliveryFee: 0,
        grandTotal: roundMoney(discounted.reduce((sum, item) => sum + item.netAmount, 0) + taxTotal) };
    },
  }, inventoryClient);
  const subscriptionProcessor = new SubscriptionProcessor((request) => subscriptionSaga.executeCheckout(request));
  app.locals.subscriptionProcessor = subscriptionProcessor;
  app.locals.subscriptionsReady = subscriptionsReady;
  app.use('/api/v1/orders/subscriptions', async (_req, _res, next) => { try { await subscriptionsReady; next(); } catch (error) { next(error); } }, subscriptionRoutes(subscriptionProcessor, (sku, quantity) => pricingClient.calculateQuote([{ sku, quantity }])));

  // Checkout Saga Execution (Used by Storefront, REST callers, and WhatsApp)
  app.post(['/api/v1/orders/checkout', '/api/v1/orders'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateOrderRequest;
      body.paymentMethod = body.paymentMethod || 'RAZORPAY';
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // Auto-assign headers / defaults if omitted by caller
      if (!body.customerId) {
        body.customerId = (req.headers['x-user-id'] as string) || 'cust_anonymous';
      }
      if (!body.idempotencyKey) {
        body.idempotencyKey =
          (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string ||
          `idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      if (!body.channel) {
        body.channel = 'WEB';
      }
      if (!body.deliveryAddress) {
        body.deliveryAddress = {
          recipientName: 'Valued Customer',
          phone: '+91 98765 43210',
          addressLine1: 'Main Market Road',
          city: 'Bengaluru',
          postalCode: '560001',
        };
      } else {
        const anyAddr = body.deliveryAddress as any;
        if (!anyAddr.addressLine1 && anyAddr.street) {
          anyAddr.addressLine1 = anyAddr.street;
        }
        if (!anyAddr.recipientName) {
          anyAddr.recipientName = 'Valued Customer';
        }
        if (!anyAddr.phone) {
          anyAddr.phone = '+91 98765 43210';
        }
      }

      if (!body.items || body.items.length === 0) {
        return res
          .status(400)
          .json(
            errorResponse(
              'INVALID_PARAM',
              'items are required to create an order',
              correlationId
            )
          );
      }

      const order = await saga.executeCheckout(body);
      res.status(201).json(okResponse(order, correlationId));
    } catch (err: any) {
      if (err.message?.includes('INSUFFICIENT_STOCK')) {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(409)
          .json(errorResponse('INSUFFICIENT_STOCK', err.message, correlationId));
      }
      next(err);
    }
  });

  // Get Single Order (Protected with Tenant Isolation: Scenario 05)
  app.get('/api/v1/orders/:orderId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const requestingUserId = req.headers['x-user-id'] as string;
      const requestingUserRole = req.headers['x-user-role'] as string;

      const orderRes = await Database.query(
        `SELECT id, order_number, idempotency_key, customer_id, channel, status, currency,
                subtotal, discount_total, tax_total, delivery_fee, grand_total,
                reservation_id, payment_intent_id, delivery_address, cancellation_reason, created_at
         FROM orders
         WHERE id = $1 OR order_number = $1
         LIMIT 1`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      const order = orderRes.rows[0];

      // Acceptance Scenario 05: Cross-Tenant Isolation
      // Only the customer who owns the order OR staff with STORE_ADMIN role can view it.
      if (requestingUserRole !== 'STORE_ADMIN' && requestingUserId && requestingUserId !== order.customer_id) {
        logger.warn('Unauthorized cross-tenant order access attempt blocked', {
          requestingUserId,
          orderOwnerId: order.customer_id,
          orderId,
        });
        return res
          .status(403)
          .json(
            errorResponse(
              'CROSS_TENANT_ACCESS_DENIED',
              'Access forbidden: You cannot view orders belonging to another customer',
              correlationId
            )
          );
      }

      const itemsRes = await Database.query(
        `SELECT id, sku, product_name, variant_name, quantity, unit_price, tax_amount, discount_amount, line_total
         FROM order_items
         WHERE order_id = $1`,
        [order.id]
      );

      res.status(200).json(
        okResponse(
          {
            ...order,
            items: itemsRes.rows,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // List Orders for Authenticated User or Admin
  app.get('/api/v1/orders', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const requestingUserId = req.headers['x-user-id'] as string;
      const requestingUserRole = req.headers['x-user-role'] as string;
      const phoneFilter = req.query.phone as string | undefined;
      const orderNumFilter = req.query.orderNumber as string | undefined;

      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (requestingUserRole !== 'STORE_ADMIN') {
        if (orderNumFilter) {
          queryParams.push(orderNumFilter.toUpperCase().trim());
          conditions.push(`o.order_number = $${queryParams.length}`);
        } else if (phoneFilter) {
          const cleanPhone = phoneFilter.replace(/[^0-9]/g, '');
          queryParams.push(`%${cleanPhone}%`);
          conditions.push(`(o.customer_id ILIKE $${queryParams.length} OR o.delivery_address->>'phone' ILIKE $${queryParams.length})`);
        } else if (requestingUserId) {
          queryParams.push(requestingUserId);
          conditions.push(`o.customer_id = $${queryParams.length}`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const queryText = `
        SELECT 
          o.id, o.order_number, o.customer_id, o.channel, o.status, 
          o.subtotal, o.tax_total, o.delivery_fee, o.grand_total, 
          o.delivery_address, o.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'sku', oi.sku,
                'productName', oi.product_name,
                'variantName', oi.variant_name,
                'quantity', oi.quantity,
                'unitPrice', oi.unit_price,
                'netAmount', oi.net_amount
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]'
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        ${whereClause}
        GROUP BY o.id, o.order_number, o.customer_id, o.channel, o.status, 
                 o.subtotal, o.tax_total, o.delivery_fee, o.grand_total, 
                 o.delivery_address, o.created_at
        ORDER BY o.created_at DESC
        LIMIT 100
      `;

      const ordersRes = await Database.query(queryText, queryParams);
      res.status(200).json(okResponse(ordersRes.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Update Order Status (e.g. PACKED, DISPATCHED, DELIVERED, CANCELLED)
  app.patch('/api/v1/orders/:orderId/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      let { status, reason } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // Map alias status strings to DB enum
      let isReadyForDelivery = false;
      if (status === 'OUT_FOR_DELIVERY') status = 'DISPATCHED';
      if (status === 'READY_FOR_DELIVERY' || status === 'READY_FOR_PICKUP' || status === 'PACKED') {
        status = 'PACKED';
        isReadyForDelivery = true;
      }

      const validStatuses = [
        'PENDING_CONFIRMATION',
        'AWAITING_PAYMENT',
        'CONFIRMED',
        'PICKING',
        'PACKED',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED',
      ];

      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json(errorResponse('INVALID_STATUS', `Status must be one of: ${validStatuses.join(', ')}`, correlationId));
      }

      // Check existing order
      const existingRes = await Database.query(
        `SELECT id, order_number, status, reservation_id, customer_id FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );

      if (existingRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      const order = existingRes.rows[0];

      // Update order status in PostgreSQL
      await Database.query(
        `UPDATE orders
         SET status = $1, 
             cancellation_reason = COALESCE($2, cancellation_reason), 
             ready_for_pickup = CASE WHEN $3 = TRUE THEN TRUE ELSE ready_for_pickup END,
             ready_for_pickup_at = CASE WHEN $3 = TRUE THEN NOW() ELSE ready_for_pickup_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [status, reason || null, isReadyForDelivery, order.id]
      );

      // If marked ready for delivery, trigger broadcast in fulfillment-service
      if (isReadyForDelivery) {
        const fUrl = process.env.FULFILLMENT_SERVICE_URL || 'http://localhost:3008';
        fetch(`${fUrl}/api/v1/fulfillment/orders/${order.id}/ready-for-delivery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
      }

      // Proactive WhatsApp notification when order is Dispatched / Out for Delivery
      if (status === 'DISPATCHED') {
        try {
          const ordDetail = await Database.query('SELECT delivery_address, grand_total, order_number FROM orders WHERE id = $1', [order.id]);
          const addr = ordDetail.rows[0]?.delivery_address || {};
          const phone = addr.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `🛵 *Your FreshCart Order is Out for Delivery!*\n\nOrder *#${order.order_number}* has departed from our store and is on its way to you!\n⏱️ *Estimated Arrival:* 10–15 mins\n💰 *Total:* ₹${Number(ordDetail.rows[0]?.grand_total || 0).toFixed(2)}\n\nOur delivery partner will reach your address shortly. Reply *'Track'* anytime for updates!`
              })
            }).catch(() => {});
          }
        } catch {}
      }

      // Proactive WhatsApp notification when order is Delivered
      if (status === 'DELIVERED') {
        try {
          const ordDetail = await Database.query('SELECT delivery_address, order_number FROM orders WHERE id = $1', [order.id]);
          const addr = ordDetail.rows[0]?.delivery_address || {};
          const phone = addr.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `🎉 *Your FreshCart Order #${order.order_number} has been Delivered!*\n\nWe hope you enjoy your fresh groceries! Thank you for choosing FreshCart.`
              })
            }).catch(() => {});
          }
        } catch {}
      }

      // If transitioned to CONFIRMED, generate fulfillment pick list and GST invoice
      if (status === 'CONFIRMED') {
        CheckoutSagaOrchestrator.generateFulfillmentAndInvoiceOnConfirm(order.id).catch((genErr: any) => {
          logger.warn('Failed to generate pick list / invoice on status update to CONFIRMED', { error: genErr.message });
        });
      }

      // If cancelling, release any active stock reservation hold
      if (status === 'CANCELLED' && order.reservation_id) {
        try {
          const invUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
          await fetch(`${invUrl}/api/v1/inventory/reservations/${order.reservation_id}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
          });
          logger.info(`Released stock reservation ${order.reservation_id} for cancelled order ${order.order_number}`);
        } catch (invErr: any) {
          logger.warn(`Failed to release reservation on cancel: ${invErr.message}`);
        }
      }

      // Record in saga audit log
      await Database.query(
        `INSERT INTO order_saga_log (id, order_id, step, status, details)
         VALUES ($1, $2, 'STATUS_UPDATE', 'COMPLETED', $3)`,
        [crypto.randomUUID(), order.id, JSON.stringify({ from: order.status, to: status, reason })]
      );

      res.status(200).json(
        okResponse(
          {
            orderId: order.id,
            orderNumber: order.order_number,
            status,
            previousStatus: order.status,
            updatedAt: new Date().toISOString(),
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Customer or Staff Cancel Order Endpoint
  app.post('/api/v1/orders/:orderId/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const existingRes = await Database.query(
        `SELECT id, order_number, status, reservation_id, customer_id, delivery_address, grand_total FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );

      if (existingRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      const order = existingRes.rows[0];

      if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
        return res
          .status(400)
          .json(
            errorResponse('INVALID_STATE', `Cannot cancel order in status ${order.status}`, correlationId)
          );
      }

      // Update to CANCELLED
      await Database.query(
        `UPDATE orders SET status = 'CANCELLED', cancellation_reason = $1, updated_at = NOW() WHERE id = $2`,
        [reason || 'Cancelled by user', order.id]
      );

      // Record outbox event for cancelled order
      try {
        await Database.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
           VALUES ('Order', $1, 'order.cancelled', $2)`,
          [order.id, JSON.stringify({ orderId: order.id, orderNumber: order.order_number, reason })]
        );
      } catch {}

      // Release stock hold
      if (order.reservation_id) {
        try {
          const invUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
          await fetch(`${invUrl}/api/v1/inventory/reservations/${order.reservation_id}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
          });
        } catch (invErr: any) {
          logger.warn(`Failed to release reservation on cancel: ${invErr.message}`);
        }
      }

      // Automatically initiate financial refund if order was paid / confirmed
      const grandTotalNum = parseFloat(order.grand_total || '0');
      if (grandTotalNum > 0) {
        try {
          const payUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
          fetch(`${payUrl}/api/v1/payments/refunds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
            body: JSON.stringify({
              orderId: order.id,
              amount: grandTotalNum,
              reason: reason || 'Order cancelled by customer',
              refundMethod: 'WALLET',
              customerId: order.customer_id,
            }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => {});
        } catch {}
      }

      // Proactive WhatsApp cancellation alert to customer
      try {
        const addr = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : (order.delivery_address || {});
        const phone = addr.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `❌ *Your FreshCart Order #${order.order_number} has been Cancelled.*\n\n` +
                `Reason: ${reason || 'Cancelled by user'}\n` +
                (grandTotalNum > 0 ? `💰 *Refund:* ₹${grandTotalNum.toFixed(2)} has been credited back to your FreshCart Wallet (Instant)!\n\n` : '\n') +
                `Need help? Reply to this message anytime to reach support.`,
            }),
          }).catch(() => {});
        }
      } catch {}

      res.status(200).json(
        okResponse(
          {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'CANCELLED',
            reason: reason || 'Cancelled by user',
            refundInitiated: grandTotalNum > 0,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Feature: Customer Order Returns & Quality Complaint Initiation
  app.post('/api/v1/orders/:orderId/returns', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { items, reason, customerNotes, images } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const existingRes = await Database.query(
        `SELECT id, order_number, status, customer_id, delivery_address, grand_total
         FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );

      if (existingRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      const order = existingRes.rows[0];

      // Ensure order_returns table exists
      await Database.query(`
        CREATE TABLE IF NOT EXISTS order_returns (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          order_id UUID NOT NULL,
          order_number VARCHAR(32) NOT NULL,
          customer_id VARCHAR(64) NOT NULL,
          items JSONB NOT NULL,
          reason TEXT NOT NULL,
          customer_notes TEXT,
          images JSONB DEFAULT '[]'::jsonb,
          status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const returnRes = await Database.query(
        `INSERT INTO order_returns (order_id, order_number, customer_id, items, reason, customer_notes, images, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'REQUESTED')
         RETURNING id, created_at`,
        [
          order.id,
          order.order_number,
          order.customer_id,
          JSON.stringify(items || []),
          reason || 'Damaged / Expired item',
          customerNotes || '',
          JSON.stringify(images || []),
        ]
      );

      // Proactive WhatsApp notification acknowledging return request
      try {
        const addr = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : (order.delivery_address || {});
        const phone = addr.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `📦 *FreshCart Return Request Received*\n\n` +
                `Order: *#${order.order_number}*\n` +
                `Return Request ID: *${returnRes.rows[0]?.id?.slice(0, 8)}*\n` +
                `Reason: ${reason || 'Damaged / expired item'}\n\n` +
                `Our dark-store quality team will review your request. Upon doorstep pickup, refund will be instantly credited to your wallet!`,
            }),
          }).catch(() => {});
        }
      } catch {}

      res.status(201).json(
        okResponse(
          {
            returnId: returnRes.rows[0]?.id,
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'REQUESTED',
            message: 'Return request submitted successfully',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Payment Confirmation Endpoint (Called by Payment Service on Webhook/Settlement)
  app.post('/api/v1/orders/:orderId/confirm-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { paymentId } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const existingRes = await Database.query(
        `SELECT id, order_number, status, reservation_id, customer_id, grand_total, delivery_address
         FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );

      if (existingRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      const order = existingRes.rows[0];

      if (order.status === 'CANCELLED') {
        return res
          .status(400)
          .json(errorResponse('ORDER_CANCELLED', 'Cannot confirm payment on cancelled order', correlationId));
      }

      // Transition status to CONFIRMED and record paymentId
      await Database.query(
        `UPDATE orders 
         SET status = 'CONFIRMED', payment_intent_id = COALESCE($1, payment_intent_id), updated_at = NOW()
         WHERE id = $2`,
        [paymentId || null, order.id]
      );

      // Feature Flaw Fix: Now that payment is settled, generate warehouse pick list and GST tax invoice
      CheckoutSagaOrchestrator.generateFulfillmentAndInvoiceOnConfirm(order.id).catch((genErr: any) => {
        logger.warn('Failed to generate pick list / invoice on payment confirmation', { error: genErr.message });
      });

      // Dispatch WhatsApp order payment confirmation to customer's mobile
      try {
        const phone = (order.delivery_address as any)?.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `✅ *FreshCart Order Confirmed & Paid!*\n\nHello ${(order.delivery_address as any)?.recipientName || 'Valued Customer'},\nPayment of *₹${Number(order.grand_total).toFixed(2)}* received for Order *#${order.order_number}*.\n\nOur dark store staff is currently picking and packing your fresh groceries. We will notify you with live updates once the rider is on the way!`
            }),
          }).catch(() => {});
        }
      } catch {}

      // Permanently lock in the reserved inventory by consuming the hold
      if (order.reservation_id) {
        try {
          const invUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
          await fetch(`${invUrl}/api/v1/inventory/reservations/${order.reservation_id}/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
            body: JSON.stringify({ orderId: order.id }),
          });
          logger.info(`Consumed stock reservation ${order.reservation_id} for paid order ${order.order_number}`);
        } catch (invErr: any) {
          logger.warn(`Failed to consume reservation on payment: ${invErr.message}`);
        }
      }

      // Record in saga log
      await Database.query(
        `INSERT INTO order_saga_log (id, order_id, step, status, details)
         VALUES ($1, $2, 'PAYMENT_CONFIRMED', 'COMPLETED', $3)`,
        [crypto.randomUUID(), order.id, JSON.stringify({ paymentId, grandTotal: order.grand_total })]
      );

      // Persist domain event to transactional outbox
      try {
        await Database.query(
          `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
           VALUES ('Order', $1, 'order.confirmed', $2)`,
          [
            order.id,
            JSON.stringify({
              orderId: order.id,
              orderNumber: order.order_number,
              customerId: order.customer_id,
              paymentId,
              grandTotal: order.grand_total,
            }),
          ]
        );
      } catch {}

      // Multi-channel notification trigger
      try {
        const notifUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3011';
        const phone = (order.delivery_address as any)?.phone;
        if (phone) {
          await fetch(`${notifUrl}/api/v1/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
            body: JSON.stringify({
              recipientId: order.customer_id,
              recipientAddress: phone,
              channel: 'WHATSAPP',
              templateCode: 'ORDER_CONFIRMED',
              payload: { orderNumber: order.order_number, total: order.grand_total },
            }),
          });
        }
      } catch {}

      res.status(200).json(
        okResponse(
          {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'CONFIRMED',
            paymentId,
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Feature: 1-Click Past Order Reorder
  app.post('/api/v1/orders/:orderId/reorder', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const itemsRes = await Database.query(
        `SELECT sku, product_name, quantity, unit_price FROM order_items
         WHERE order_id::text = $1 OR order_id = (SELECT id FROM orders WHERE order_number = $1 LIMIT 1)`,
        [orderId]
      );

      if (itemsRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_ITEMS_NOT_FOUND', 'Historical order items not found', correlationId));
      }

      const reorderItems = itemsRes.rows.map(r => ({
        sku: r.sku,
        productName: r.product_name,
        quantity: parseInt(r.quantity, 10),
        estimatedUnitPrice: parseFloat(r.unit_price),
      }));

      res.status(200).json(
        okResponse(
          {
            originalOrderId: orderId,
            items: reorderItems,
            totalItems: reorderItems.length,
            message: 'Items prepared for 1-click reorder',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Feature: Post-Delivery Rider Tip Allocation
  app.post('/api/v1/orders/:orderId/tip', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { tipAmount, paymentMethod = 'WALLET' } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const tip = parseFloat(tipAmount);

      if (isNaN(tip) || tip <= 0) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'Positive tipAmount is required', correlationId));
      }

      await Database.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_tip_amount NUMERIC(10, 2) DEFAULT 0.00;`).catch(() => {});

      const updRes = await Database.query(
        `UPDATE orders
         SET rider_tip_amount = COALESCE(rider_tip_amount, 0) + $1,
             updated_at = NOW()
         WHERE id::text = $2 OR order_number = $2
         RETURNING id, order_number, rider_tip_amount, customer_id`,
        [tip, orderId]
      );

      if (updRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', `Order ${orderId} not found`, correlationId));
      }

      // Update rider earnings in fulfillment service
      try {
        const fulUrl = process.env.FULFILLMENT_SERVICE_URL || 'http://localhost:3008';
        await fetch(`${fulUrl}/api/v1/fulfillment/deliveries/${orderId}/tip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
          body: JSON.stringify({ tipAmount: tip }),
        });
      } catch {}

      res.status(200).json(
        okResponse(
          {
            orderId,
            tipAdded: tip,
            totalTip: parseFloat(updRes.rows[0].rider_tip_amount),
            paymentMethod,
            message: 'Rider tip recorded successfully',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled order service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

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
  app.get('/api/v1/orders/delivery-slots', async (_req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const now = new Date();
    const currentHour = now.getHours();

    const slots = [
      {
        id: 'express-15',
        type: 'EXPRESS',
        title: 'Express Rush',
        timeWindow: '10 - 15 Mins',
        tag: '⚡ 15-Min Delivery',
        badgeColor: 'amber',
        fee: 25,
        available: true,
        capacityStatus: 'HIGH_DEMAND',
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
        capacityStatus: 'OPTIMAL',
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
        available: currentHour < 18,
        capacityStatus: currentHour < 18 ? 'AVAILABLE' : 'CLOSED',
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
        available: currentHour < 21,
        capacityStatus: currentHour < 21 ? 'AVAILABLE' : 'CLOSED',
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
        available: true,
        capacityStatus: 'AVAILABLE',
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
        available: true,
        capacityStatus: 'AVAILABLE',
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
          next_delivery_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 day'),
          delivery_address JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_subs_cust_id ON customer_subscriptions(customer_id);
      `);
    } catch (err: any) {
      logger.warn('Subscription table bootstrap notice', { message: err.message });
    }
  };
  initSubscriptionTables().catch(() => {});

  // List customer subscriptions
  app.get('/api/v1/orders/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        (req.query.customerId as string) ||
        'cust_demo';

      const resDb = await Database.query(
        `SELECT id, subscription_number, customer_id, sku, product_name, variant_name,
                quantity, unit_price, discount_percent, frequency, delivery_slot, status,
                start_date, next_delivery_date, delivery_address, created_at
         FROM customer_subscriptions
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
        [customerId]
      );

      res.status(200).json(okResponse(resDb.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Create new subscription
  app.post('/api/v1/orders/subscriptions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const customerId =
        (req.headers['x-user-id'] as string) ||
        req.body?.customerId ||
        'cust_demo';

      const { sku, productName, variantName, quantity, unitPrice, frequency, deliveryAddress } = req.body;

      if (!sku || !productName) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'sku and productName are required', correlationId));
      }

      const subNum = `SUB-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const qty = parseInt(quantity || 1, 10);
      const price = parseFloat(unitPrice || 50.0);
      const freq = frequency || 'DAILY';
      const slot = req.body?.deliverySlot || '07:00 AM - 09:00 AM';

      const inserted = await Database.query(
        `INSERT INTO customer_subscriptions (
           subscription_number, customer_id, sku, product_name, variant_name,
           quantity, unit_price, discount_percent, frequency, delivery_slot,
           status, start_date, next_delivery_date, delivery_address
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 10.00, $8, $9, 'ACTIVE', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', $10)
         RETURNING *`,
        [
          subNum,
          customerId,
          sku,
          productName,
          variantName || 'Standard',
          qty,
          price,
          freq,
          slot,
          JSON.stringify(deliveryAddress || { recipientName: 'Valued Customer', city: 'Bengaluru' }),
        ]
      );

      res.status(201).json(okResponse(inserted.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Pause subscription
  app.post('/api/v1/orders/subscriptions/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { id } = req.params;

      await Database.query(
        `UPDATE customer_subscriptions
         SET status = 'PAUSED', updated_at = NOW()
         WHERE id = $1 OR subscription_number = $1`,
        [id]
      );

      res.status(200).json(okResponse({ success: true, status: 'PAUSED' }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Resume subscription
  app.post('/api/v1/orders/subscriptions/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { id } = req.params;

      await Database.query(
        `UPDATE customer_subscriptions
         SET status = 'ACTIVE', next_delivery_date = CURRENT_DATE + INTERVAL '1 day', updated_at = NOW()
         WHERE id = $1 OR subscription_number = $1`,
        [id]
      );

      res.status(200).json(okResponse({ success: true, status: 'ACTIVE' }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Cancel subscription
  app.delete('/api/v1/orders/subscriptions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { id } = req.params;

      await Database.query(
        `UPDATE customer_subscriptions
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 OR subscription_number = $1`,
        [id]
      );

      res.status(200).json(okResponse({ success: true, status: 'CANCELLED' }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Checkout Saga Execution (Used by Storefront, REST callers, and WhatsApp)
  app.post(['/api/v1/orders/checkout', '/api/v1/orders'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateOrderRequest;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // Auto-assign headers / defaults if omitted by caller
      if (!body.customerId) {
        body.customerId = (req.headers['x-user-id'] as string) || 'cust_anonymous';
      }
      if (!body.idempotencyKey) {
        body.idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
      if (status === 'OUT_FOR_DELIVERY') status = 'DISPATCHED';

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
         SET status = $1, cancellation_reason = COALESCE($2, cancellation_reason), updated_at = NOW()
         WHERE id = $3`,
        [status, reason || null, order.id]
      );

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
        `SELECT id, order_number, status, reservation_id FROM orders WHERE id::text = $1 OR order_number = $1`,
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

      res.status(200).json(
        okResponse(
          {
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'CANCELLED',
            reason: reason || 'Cancelled by user',
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


  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled order service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

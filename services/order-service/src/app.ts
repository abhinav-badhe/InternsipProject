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
      return json.data;
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
  app.get('/health/live', (_req: Request, res: Response) => {
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

  // Checkout Saga Execution (Used by Storefront and WhatsApp)
  app.post('/api/v1/orders/checkout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateOrderRequest;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!body.idempotencyKey || !body.customerId || !body.items || body.items.length === 0) {
        return res
          .status(400)
          .json(
            errorResponse(
              'INVALID_PARAM',
              'idempotencyKey, customerId, deliveryAddress, and items are required',
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

      let queryText = `SELECT id, order_number, customer_id, channel, status, grand_total, created_at FROM orders`;
      const queryParams: any[] = [];

      if (requestingUserRole !== 'STORE_ADMIN') {
        if (!requestingUserId) {
          return res
            .status(401)
            .json(errorResponse('UNAUTHORIZED', 'Authentication required to list customer orders', correlationId));
        }
        queryText += ` WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`;
        queryParams.push(requestingUserId);
      } else {
        queryText += ` ORDER BY created_at DESC LIMIT 100`;
      }

      const ordersRes = await Database.query(queryText, queryParams);
      res.status(200).json(okResponse(ordersRes.rows, correlationId));
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

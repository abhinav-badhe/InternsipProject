import express, { Request, Response, NextFunction } from 'express';
import { PaymentProcessor, OrderClient } from './payment.processor.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('payment-service:api');

export function createApp(deps?: { orderClient?: OrderClient }): express.Application {
  const app = express();

  // Capture raw body for webhook HMAC signature calculation
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const orderClient: OrderClient = deps?.orderClient || {
    getOrderStatus: async (orderId) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/${orderId}`
      );
      const json: any = await res.json();
      return json.data?.status || 'CANCELLED';
    },
    confirmOrderPayment: async (orderId, paymentId) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/${orderId}/confirm-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        }
      );
      return res.ok;
    },
  };

  const processor = new PaymentProcessor(orderClient);

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'payment-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming payment request', { method: req.method, path: req.path });
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

  // Create Payment Intent (Called during checkout)
  app.post('/api/v1/payments/intents', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, amount, currency } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!orderId || typeof amount !== 'number' || amount <= 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId and positive amount are required', correlationId));
      }

      const result = await processor.createPaymentIntent({ orderId, amount, currency });
      res.status(201).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Payment Provider Webhook Receiver (Acceptance Scenarios 3 & 4)
  app.post('/webhook/payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'test_webhook_secret_key';
      const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

      const outcome = await processor.handleWebhook({
        rawBody,
        signatureHeader,
        webhookSecret,
        payload: req.body,
      });

      res.status(200).json(okResponse(outcome, correlationId));
    } catch (err: any) {
      if (err.message?.includes('INVALID_SIGNATURE')) {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', 'Invalid or forged webhook signature', correlationId));
      }
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled payment service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

import express, { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from './auth.middleware.js';
import { InMemoryRateLimiter } from './rate-limiter.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('api-gateway:router');

export interface GatewayServicesConfig {
  identityServiceUrl?: string;
  catalogServiceUrl?: string;
  pricingServiceUrl?: string;
  inventoryServiceUrl?: string;
  orderServiceUrl?: string;
  whatsappAdapterUrl?: string;
  paymentServiceUrl?: string;
  fulfillmentServiceUrl?: string;
  invoiceServiceUrl?: string;
  analyticsServiceUrl?: string;
  jwtSecret?: string;
  rateLimitMaxRequests?: number;
  rateLimitWindowMs?: number;
  dispatcher?: (
    serviceUrl: string,
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ) => Promise<{ status: number; body: any }>;
}

export function createApp(config?: GatewayServicesConfig): express.Application {
  const app = express();
  app.use(express.json());

  // CORS Middleware for frontend web applications
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-Id');
    if (_req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const authMiddleware = new AuthMiddleware(config?.jwtSecret);
  const rateLimiter = new InMemoryRateLimiter(
    config?.rateLimitWindowMs || 60000,
    config?.rateLimitMaxRequests || 100
  );

  const urls = {
    identity: config?.identityServiceUrl || process.env.IDENTITY_SERVICE_URL || 'http://localhost:3007',
    catalog: config?.catalogServiceUrl || process.env.CATALOG_SERVICE_URL || 'http://localhost:3001',
    pricing: config?.pricingServiceUrl || process.env.PRICING_SERVICE_URL || 'http://localhost:3002',
    inventory: config?.inventoryServiceUrl || process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003',
    order: config?.orderServiceUrl || process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
    whatsapp: config?.whatsappAdapterUrl || process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005',
    payment: config?.paymentServiceUrl || process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006',
    fulfillment: config?.fulfillmentServiceUrl || process.env.FULFILLMENT_SERVICE_URL || 'http://localhost:3008',
    invoice: config?.invoiceServiceUrl || process.env.INVOICE_SERVICE_URL || 'http://localhost:3009',
    analytics: config?.analyticsServiceUrl || process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3010',
  };

  // Helper forwarder function
  const forwardRequest = async (
    targetBaseUrl: string,
    req: Request,
    res: Response,
    targetPath?: string
  ) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const path = targetPath || req.originalUrl;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
    };

    if (req.user) {
      headers['x-user-id'] = req.user.userId;
      headers['x-user-role'] = req.user.role;
      if (req.user.email) headers['x-user-email'] = req.user.email;
    }

    try {
      if (config?.dispatcher) {
        const result = await config.dispatcher(targetBaseUrl, req.method, path, headers, req.body);
        return res.status(result.status).json(result.body);
      }

      const response = await fetch(`${targetBaseUrl}${path}`, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      const responseBody = await response.json();
      return res.status(response.status).json(responseBody);
    } catch (err: any) {
      logger.error('Failed to proxy request downstream', {
        target: targetBaseUrl,
        path,
        error: err.message,
      });
      return res
        .status(502)
        .json(
          errorResponse('BAD_GATEWAY', `Downstream service connection failure: ${err.message}`, correlationId)
        );
    }
  };

  // 1. Correlation ID Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'api-gateway',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming gateway request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // 2. Global Rate Limiter
  app.use(rateLimiter.middleware);

  // 3. Health Checks
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready', gateway: 'operational' });
  });

  // 4. Public Authentication Routes -> identity-service
  app.use('/api/v1/auth', (req: Request, res: Response) => {
    forwardRequest(urls.identity, req, res);
  });

  // 5. Public Catalog Read Routes -> catalog-service
  app.get('/api/v1/catalog*', (req: Request, res: Response) => {
    forwardRequest(urls.catalog, req, res);
  });

  // 6. Public Pricing Quote Routes -> pricing-service
  app.post('/api/v1/pricing/quote', (req: Request, res: Response) => {
    forwardRequest(urls.pricing, req, res);
  });

  // 7. Payment Webhook Receiver (Raw body / provider signatures) -> payment-service
  app.use('/api/v1/payments/webhook', (req: Request, res: Response) => {
    forwardRequest(urls.payment, req, res);
  });

  // 8. WhatsApp Webhook Handshake & Inbound Receiver -> whatsapp-adapter
  app.use('/api/v1/whatsapp/webhook', (req: Request, res: Response) => {
    forwardRequest(urls.whatsapp, req, res);
  });

  // -------------------------------------------------------------
  // Protected Routes (Require Valid Bearer Token)
  // -------------------------------------------------------------

  // Protected Orders API (Checkout, My Orders, Single Order with Scenario 05 tenant check)
  app.use('/api/v1/orders*', authMiddleware.authenticate, (req: Request, res: Response) => {
    forwardRequest(urls.order, req, res);
  });

  // Staff-only Catalog Management
  app.post(
    '/api/v1/catalog*',
    authMiddleware.authenticate,
    authMiddleware.requireRole('STORE_ADMIN', 'INVENTORY_STAFF'),
    (req: Request, res: Response) => {
      forwardRequest(urls.catalog, req, res);
    }
  );

  // Staff-only Inventory Management
  app.use(
    '/api/v1/inventory*',
    authMiddleware.authenticate,
    authMiddleware.requireRole('STORE_ADMIN', 'INVENTORY_STAFF'),
    (req: Request, res: Response) => {
      forwardRequest(urls.inventory, req, res);
    }
  );

  // Fulfillment & Pick-Pack Operations
  app.use(
    '/api/v1/fulfillment*',
    authMiddleware.authenticate,
    authMiddleware.requireRole('STORE_ADMIN', 'INVENTORY_STAFF'),
    (req: Request, res: Response) => {
      forwardRequest(urls.fulfillment, req, res);
    }
  );

  // Invoices & Tax Compliance
  app.use('/api/v1/invoices*', (req: Request, res: Response) => {
    forwardRequest(urls.invoice, req, res);
  });

  // Analytics, Demand Forecasting & Risk
  app.use(
    '/api/v1/analytics*',
    authMiddleware.authenticate,
    authMiddleware.requireRole('STORE_ADMIN'),
    (req: Request, res: Response) => {
      forwardRequest(urls.analytics, req, res);
    }
  );

  // Global Error Handler (Fails closed: strips internal error details)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled API Gateway exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

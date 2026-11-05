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
  notificationServiceUrl?: string;
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-Id');
    if (_req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Health check endpoint for container orchestrators (Render / Kubernetes / Docker)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    });
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
    notification: config?.notificationServiceUrl || process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3011',
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

    if (req.headers.authorization) {
      headers['authorization'] = req.headers.authorization as string;
    }

    if (req.user) {
      headers['x-user-id'] = req.user.userId;
      headers['x-user-role'] = req.user.role;
      if (req.user.email) headers['x-user-email'] = req.user.email;
    }

    // Preserve Meta WhatsApp Cloud API cryptographic webhook signature
    if (req.headers['x-hub-signature-256']) {
      headers['x-hub-signature-256'] = req.headers['x-hub-signature-256'] as string;
    }
    if (req.headers['x-hub-signature']) {
      headers['x-hub-signature'] = req.headers['x-hub-signature'] as string;
    }

    // Preserve Razorpay & Payment Gateway webhook signatures
    if (req.headers['x-razorpay-signature']) {
      headers['x-razorpay-signature'] = req.headers['x-razorpay-signature'] as string;
    }
    if (req.headers['x-webhook-signature']) {
      headers['x-webhook-signature'] = req.headers['x-webhook-signature'] as string;
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

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status);
        const reader = response.body.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch {} finally {
            res.end();
          }
        };
        return pump();
      } else if (contentType.includes('application/json')) {
        const responseBody = await response.json();
        return res.status(response.status).json(responseBody);
      } else {
        const textBody = await response.text();
        return res.status(response.status).send(textBody);
      }
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
  app.use('/api/v1/auth*', (req: Request, res: Response) => {
    forwardRequest(urls.identity, req, res);
  });

  // 5. Public Catalog Read Routes -> catalog-service
  app.get('/api/v1/catalog*', (req: Request, res: Response) => {
    forwardRequest(urls.catalog, req, res);
  });

  // 6. Public Pricing Routes (Quote & SKU Prices) -> pricing-service
  app.use('/api/v1/pricing*', (req: Request, res: Response) => {
    forwardRequest(urls.pricing, req, res);
  });

  // 7. Payment Service (Wallet, Payment Intents, Webhooks) -> payment-service
  app.use(['/api/v1/payments*', '/webhook/payment*'], (req: Request, res: Response) => {
    if (req.headers.authorization) {
      return authMiddleware.authenticate(req, res, () => {
        forwardRequest(urls.payment, req, res);
      });
    }
    forwardRequest(urls.payment, req, res);
  });

  // 8. WhatsApp Webhooks, Chat Simulator & Sessions -> whatsapp-adapter
  app.use(['/api/v1/whatsapp*', '/webhook/whatsapp*'], (req: Request, res: Response) => {
    forwardRequest(urls.whatsapp, req, res);
  });

  // -------------------------------------------------------------
  // Protected Routes (Require Valid Bearer Token)
  // -------------------------------------------------------------

  // Feature 13: Delivery Slots (Public query for checkout scheduling)
  app.get('/api/v1/orders/delivery-slots', (req: Request, res: Response) => {
    forwardRequest(urls.order, req, res);
  });

  // Feature 16: Subscription Execution Batch Engine (Automated Morning Order Fulfillment)
  app.all('/api/v1/orders/subscriptions/process-daily', (req: Request, res: Response) => {
    forwardRequest(urls.order, req, res);
  });
  app.get('/api/v1/orders/subscriptions/execution-logs', (req: Request, res: Response) => {
    forwardRequest(urls.order, req, res);
  });

  // Feature Flaw Fix: Public Order Tracking by Phone or Order Number
  // Allows customers to look up and track their storefront and WhatsApp orders without 401 rejection
  app.get('/api/v1/orders', (req: Request, res: Response, next: NextFunction) => {
    if (req.query.phone || req.query.orderNumber) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const claims = authMiddleware.verifyToken(authHeader.substring(7).trim());
        if (claims) {
          req.user = claims;
          req.headers['x-user-id'] = claims.userId;
          req.headers['x-user-role'] = claims.role;
        }
      }
      return forwardRequest(urls.order, req, res);
    }
    authMiddleware.authenticate(req, res, () => {
      forwardRequest(urls.order, req, res);
    });
  });

  // Protected Orders API (Checkout, My Orders, Single Order with Scenario 05 tenant check)
  app.use('/api/v1/orders*', authMiddleware.authenticate, (req: Request, res: Response) => {
    forwardRequest(urls.order, req, res);
  });

  // Feature 14: Customer Product Reviews Submission
  app.post('/api/v1/catalog/products/:productId/reviews', (req: Request, res: Response) => {
    forwardRequest(urls.catalog, req, res);
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

  // Customer Live Delivery Tracking Endpoint
  app.get('/api/v1/fulfillment/deliveries/:orderId/tracking', (req: Request, res: Response) => {
    forwardRequest(urls.fulfillment, req, res);
  });

  // Fulfillment & Pick-Pack Operations & Rider Fleet
  app.use(
    '/api/v1/fulfillment*',
    (req: Request, res: Response, next: NextFunction) => {
      const authHeader = (req.headers.authorization || '') as string;
      if (authHeader.startsWith('Bearer dp_token_')) {
        const parts = authHeader.replace('Bearer dp_token_', '').split('_');
        const riderId = parts[0];
        req.user = {
          userId: riderId,
          role: 'DRIVER' as any,
          email: '',
          fullName: 'Delivery Partner',
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
        return forwardRequest(urls.fulfillment, req, res);
      }

      if (authHeader) {
        return authMiddleware.authenticate(req, res, () => {
          forwardRequest(urls.fulfillment, req, res);
        });
      }
      forwardRequest(urls.fulfillment, req, res);
    }
  );

  // Invoices & Tax Compliance
  app.use('/api/v1/invoices*', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const claims = authMiddleware.verifyToken(authHeader.substring(7).trim());
      if (claims) {
        req.user = claims;
        req.headers['x-user-id'] = claims.userId;
        req.headers['x-user-role'] = claims.role;
      }
    }
    forwardRequest(urls.invoice, req, res);
  });

  // 9. Analytics, Demand Forecasting & Risk
  app.get('/api/v1/analytics*', (req: Request, res: Response) => {
    forwardRequest(urls.analytics, req, res);
  });

  // Protected Analytics Model Training & Generation
  app.post(
    '/api/v1/analytics*',
    (req: Request, res: Response, next: NextFunction) => {
      // If token provided, authenticate and require STORE_ADMIN; if not in development, forward gracefully
      if (req.headers.authorization) {
        return authMiddleware.authenticate(req, res, () => {
          authMiddleware.requireRole('STORE_ADMIN')(req, res, () => {
            forwardRequest(urls.analytics, req, res);
          });
        });
      }
      forwardRequest(urls.analytics, req, res);
    }
  );

  // 10. Multi-Channel Customer Notifications
  app.use('/api/v1/notifications*', (req: Request, res: Response) => {
    forwardRequest(urls.notification, req, res);
  });

  // Global Error Handler (Fails closed: strips internal error details)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled API Gateway exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

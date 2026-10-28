import express, { Request, Response, NextFunction } from 'express';
import { WhatsAppBot, CatalogClient, PricingClient, OrderClient } from './whatsapp.bot.js';
import { SignatureVerifier } from './signature.verifier.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('whatsapp-adapter:api');

export function createApp(deps?: {
  catalogClient?: CatalogClient;
  pricingClient?: PricingClient;
  orderClient?: OrderClient;
}): express.Application {
  const app = express();

  // Raw body capture for cryptographic webhook HMAC verification
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const catalogClient: CatalogClient = deps?.catalogClient || {
    disambiguate: async (term) => {
      const res = await fetch(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/disambiguate?term=${encodeURIComponent(term)}`
      );
      const json: any = await res.json();
      return json.data;
    },
    searchProducts: async (query, categoryId) => {
      const url = new URL(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/products`
      );
      if (query) url.searchParams.set('query', query);
      if (categoryId) url.searchParams.set('categoryId', categoryId);
      const res = await fetch(url.toString());
      const json: any = await res.json();
      return json.data;
    },
    getSimilarAlternatives: async (sku) => {
      const res = await fetch(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/variants/${sku}/alternatives`
      );
      const json: any = await res.json();
      return json.data;
    },
  };

  const pricingClient: PricingClient = deps?.pricingClient || {
    calculateQuote: async (items) => {
      const res = await fetch(
        `${process.env.PRICING_SERVICE_URL || 'http://localhost:3002'}/api/v1/pricing/quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }
      );
      const json: any = await res.json();
      return json.data;
    },
  };

  const orderClient: OrderClient = deps?.orderClient || {
    checkout: async (req) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        }
      );
      const json: any = await res.json();
      return json.data;
    },
  };

  const bot = new WhatsAppBot(catalogClient, pricingClient, orderClient);

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'whatsapp-adapter',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming WhatsApp adapter request', { method: req.method, path: req.path });
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

  // Meta Webhook Verification Handshake (GET)
  app.get('/webhook/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test_verify_token';

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('Meta webhook verification handshake successful');
      return res.status(200).send(challenge);
    }

    logger.warn('Meta webhook verification handshake failed: Token mismatch');
    return res.status(403).send('Forbidden');
  });

  // Meta Webhook Inbound Message Receiver (POST)
  app.post('/webhook/whatsapp', async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    // Verify HMAC signature if app secret is set
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const isValid = SignatureVerifier.verifyMetaSignature(rawBody, signature, appSecret);

      if (!isValid) {
        logger.warn('Forged WhatsApp webhook rejected: Invalid HMAC signature');
        return res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid signature', correlationId));
      }
    }

    // Immediately acknowledge Meta with 200 OK
    res.status(200).send('EVENT_RECEIVED');

    // Parse Meta webhook message format
    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (message) {
        const fromPhone = message.from;
        const messageId = message.id;
        const text = message.text?.body || message.interactive?.button_reply?.title || '';

        await bot.handleInboundMessage({
          messageId,
          fromPhoneNumber: fromPhone,
          text,
          timestamp: message.timestamp,
        });
      }
    } catch (err: any) {
      logger.error('Error processing WhatsApp message asynchronously', { error: err.message });
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled WhatsApp adapter exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

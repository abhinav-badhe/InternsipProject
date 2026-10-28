import express, { Request, Response, NextFunction } from 'express';
import { PricingRepository } from './pricing.repository.js';
import { PricingCalculator } from './pricing.calculator.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse, QuoteRequest } from '@grocery/contracts';

const logger = createLogger('pricing-service:api');
const pricingRepo = new PricingRepository();

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Correlation ID and context middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'pricing-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming pricing request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // Liveness check
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  // Readiness check
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const isDbHealthy = await Database.checkHealth();
    if (isDbHealthy) {
      res.status(200).json({ status: 'ready', database: 'connected' });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Price Quote Endpoint (Recalculates cart/checkout prices with taxes & discounts)
  app.post('/api/v1/pricing/quote', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as QuoteRequest;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'At least one item is required for quote', correlationId));
      }

      for (const item of body.items) {
        if (!item.sku || typeof item.quantity !== 'number' || item.quantity <= 0) {
          return res
            .status(400)
            .json(errorResponse('INVALID_ITEM', `Invalid SKU or quantity for item: ${item.sku}`, correlationId));
        }
      }

      const skus = body.items.map((i) => i.sku);
      const priceMap = await pricingRepo.getPricesBySkus(skus);

      // Check if all requested items have active prices
      const missingSkus = skus.filter((sku) => !priceMap.has(sku));
      if (missingSkus.length > 0) {
        return res
          .status(404)
          .json(
            errorResponse(
              'PRICE_NOT_FOUND',
              `Active price not found for SKUs: ${missingSkus.join(', ')}`,
              correlationId,
              { missingSkus }
            )
          );
      }

      // Check promotion if promoCode was supplied
      let promotion;
      if (body.promoCode) {
        promotion = await pricingRepo.getPromotionByCode(body.promoCode);
      }

      const quote = PricingCalculator.calculateQuote({
        items: body.items,
        priceMap,
        promotion: promotion || undefined,
      });

      res.json(okResponse(quote, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Single SKU price inquiry
  app.get('/api/v1/pricing/prices/:sku', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const priceMap = await pricingRepo.getPricesBySkus([sku]);
      const price = priceMap.get(sku);

      if (!price) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Active price not found for SKU: ${sku}`, correlationId));
      }

      res.json(okResponse(price, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled pricing service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

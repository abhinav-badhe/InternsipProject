import express, { Request, Response, NextFunction } from 'express';
import { CatalogRepository } from './catalog.repository.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('catalog-service:api');
const catalogRepo = new CatalogRepository();

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
        serviceName: 'catalog-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming request', { method: req.method, path: req.path });
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

  // Categories list
  app.get('/api/v1/catalog/categories', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await catalogRepo.getCategories();
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      res.json(okResponse(categories, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Category Disambiguation (Used by WhatsApp Adapter to resolve terms like "soap")
  app.get('/api/v1/catalog/disambiguate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const term = (req.query.term as string) || '';
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!term.trim()) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'Search term query parameter is required', correlationId));
      }

      const result = await catalogRepo.disambiguateCategory(term);
      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Product Search
  app.get('/api/v1/catalog/products', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, categoryId, brandId, limit, offset } = req.query;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const result = await catalogRepo.searchProducts({
        query: query as string,
        categoryId: categoryId as string,
        brandId: brandId as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Similar Product Alternatives (Used when SKU is out of stock)
  app.get('/api/v1/catalog/variants/:sku/alternatives', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const result = await catalogRepo.getSimilarAlternatives(sku);
      if (!result) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Product variant with SKU ${sku} was not found`, correlationId));
      }

      res.json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler (Fails closed, never leaks stack traces)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled server exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

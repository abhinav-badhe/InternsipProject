import express, { Request, Response, NextFunction } from 'express';
import { ForecasterService } from './forecaster.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('analytics-service:api');
const forecaster = new ForecasterService();

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'analytics-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming analytics request', { method: req.method, path: req.path });
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

  // Demand Forecast (Scenario 15: Tags model version and data freshness)
  app.get('/api/v1/analytics/forecast/:sku', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const horizonDays = Number(req.query.horizonDays || 7);
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const forecast = await forecaster.computeSkuForecast(sku, horizonDays);
      res.status(200).json(okResponse(forecast, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Stockout Risk Assessment (Scenario 15: Computes days-of-supply against supplier lead time)
  app.post('/api/v1/analytics/stockout-risk', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku, currentAuthoritativeStock, supplierLeadTimeDays, safetyStockDays } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!sku || currentAuthoritativeStock === undefined || supplierLeadTimeDays === undefined) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'sku, currentAuthoritativeStock, and supplierLeadTimeDays are required', correlationId));
      }

      const risk = await forecaster.assessStockoutRisk({
        sku,
        currentAuthoritativeStock: Number(currentAuthoritativeStock),
        supplierLeadTimeDays: Number(supplierLeadTimeDays),
        safetyStockDays: safetyStockDays ? Number(safetyStockDays) : undefined,
      });

      res.status(200).json(okResponse(risk, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled analytics service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

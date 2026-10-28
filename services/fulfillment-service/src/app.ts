import express, { Request, Response, NextFunction } from 'express';
import { FulfillmentService } from './fulfillment.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('fulfillment-service:api');
const fulfillmentService = new FulfillmentService();

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
        serviceName: 'fulfillment-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming fulfillment request', { method: req.method, path: req.path });
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

  // Generate Pick List for Order
  app.post('/api/v1/fulfillment/pick-lists', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, orderNumber, customerId, zone, items } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!orderId || !orderNumber || !customerId || !items || !Array.isArray(items)) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId, orderNumber, customerId, and items are required', correlationId));
      }

      const pickList = await fulfillmentService.generatePickList({
        orderId,
        orderNumber,
        customerId,
        zone,
        items,
      });

      res.status(201).json(okResponse(pickList, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Propose Substitution (Picker finds item missing/damaged)
  app.post('/api/v1/fulfillment/substitutions/propose', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pickListId, pickItemId, originalSku, proposedSku, proposedProductName, priceDelta } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!pickListId || !pickItemId || !originalSku || !proposedSku) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'pickListId, pickItemId, originalSku, and proposedSku are required', correlationId));
      }

      const result = await fulfillmentService.proposeSubstitution({
        pickListId,
        pickItemId,
        originalSku,
        proposedSku,
        proposedProductName,
        priceDelta: Number(priceDelta || 0),
      });

      res.status(201).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Record Customer Decision on Substitution Proposal
  app.post('/api/v1/fulfillment/substitutions/:proposalId/decision', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proposalId = req.params.proposalId as string;
      const { approved, decisionNotes } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (typeof approved !== 'boolean') {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'approved (boolean) is required', correlationId));
      }

      const result = await fulfillmentService.recordSubstitutionDecision({
        proposalId,
        approved,
        decisionNotes,
      });

      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled fulfillment service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

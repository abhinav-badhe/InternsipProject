import express, { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('notification-service:api');
const notificationService = new NotificationService();

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
        serviceName: 'notification-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming notification request', { method: req.method, path: req.path });
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

  // Send Notification Endpoint
  app.post('/api/v1/notifications/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recipientId, recipientAddress, channel, templateCode, payload, isMarketing } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!recipientId || !recipientAddress || !channel || !templateCode) {
        return res
          .status(400)
          .json(
            errorResponse(
              'INVALID_PARAM',
              'recipientId, recipientAddress, channel, and templateCode are required',
              correlationId
            )
          );
      }

      const result = await notificationService.sendNotification({
        recipientId,
        recipientAddress,
        channel,
        templateCode,
        payload: payload || {},
        isMarketing: Boolean(isMarketing),
      });

      res.status(201).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled notification service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

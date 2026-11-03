import express, { Request, Response, NextFunction } from 'express';
import { InventoryRepository } from './inventory.repository.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse, ReserveStockRequest } from '@grocery/contracts';

const logger = createLogger('inventory-service:api');
const inventoryRepo = new InventoryRepository();

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
        serviceName: 'inventory-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming inventory request', { method: req.method, path: req.path });
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

  // Concurrency-Safe Stock Reservation
  app.post('/api/v1/inventory/reserve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ReserveStockRequest;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!body.reservationId || !body.items || body.items.length === 0) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'reservationId and items are required', correlationId));
      }

      const outcome = await inventoryRepo.reserveStock(body);
      if (outcome.status === 'INSUFFICIENT_STOCK') {
        return res
          .status(409)
          .json(
            errorResponse('INSUFFICIENT_STOCK', 'One or more items are out of stock', correlationId, outcome)
          );
      }

      res.status(201).json(okResponse(outcome, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Release reservation (e.g. on checkout cancellation)
  app.post('/api/v1/inventory/reservations/:id/release', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id as string;
      const reason = (req.body?.reason as string) || 'MANUAL_RELEASE';
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const success = await inventoryRepo.releaseReservation(reservationId, reason);
      res.json(okResponse({ reservationId, released: success }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Consume reservation on payment confirmation
  app.post('/api/v1/inventory/reservations/:id/consume', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id as string;
      const orderId = req.body?.orderId as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!orderId) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId is required to consume reservation', correlationId));
      }

      const success = await inventoryRepo.consumeReservation(reservationId, orderId);
      res.json(okResponse({ reservationId, orderId, consumed: success }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Get all stock balances
  app.get('/api/v1/inventory/balances', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const balances = await inventoryRepo.getAllBalances();
      res.json(okResponse(balances, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Get stock movement ledger
  app.get('/api/v1/inventory/movements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const movements = await inventoryRepo.getMovements(limit);
      res.json(okResponse(movements, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Get balance for SKU
  app.get('/api/v1/inventory/balances/:sku', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sku = req.params.sku as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const balance = await inventoryRepo.getBalanceBySku(sku);
      if (!balance) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `Stock balance not found for SKU: ${sku}`, correlationId));
      }

      res.json(okResponse(balance, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Adjust stock balance with reason code
  app.post('/api/v1/inventory/adjust', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sku, delta, reason, referenceId, locationZone } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!sku || delta === undefined) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'sku and delta are required', correlationId));
      }

      const result = await inventoryRepo.adjustStock({
        sku,
        delta: Number(delta),
        reason: reason || 'RECEIPT',
        referenceId,
        locationZone,
      });

      // Notify WhatsApp adapter of restocked item for waiting customers
      if (Number(delta) > 0 && result.sellableQuantity > 0) {
        const adapterUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
        fetch(`${adapterUrl}/api/v1/whatsapp/restock-notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku,
            availableStock: result.sellableQuantity,
          }),
        }).catch((notifyErr: any) => {
          logger.warn('Failed to notify whatsapp-adapter of restock', { sku, error: notifyErr.message });
        });
      }

      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Background trigger to clean up expired reservations
  app.post('/api/v1/inventory/cleanup-expired', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const count = await inventoryRepo.releaseExpiredReservations();
      res.json(okResponse({ cleanedCount: count }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled inventory service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

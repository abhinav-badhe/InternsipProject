import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
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

  // Get Live Fulfillment Tasks & Pick Lists for Store Admin & Pickers
  app.get('/api/v1/fulfillment/tasks', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // 1. Check if pick lists exist; if empty, backfill from recent active orders
      const countRes = await Database.query(`SELECT COUNT(*) as count FROM pick_items`);
      const existingCount = parseInt(countRes.rows[0]?.count || '0', 10);

      if (existingCount === 0) {
        // Backfill pick lists from authoritative orders table
        const ordersRes = await Database.query(
          `SELECT o.id, o.order_number, o.customer_id
           FROM orders o
           ORDER BY o.created_at DESC LIMIT 20`
        );

        for (const ord of ordersRes.rows) {
          const itemsRes = await Database.query(
            `SELECT sku, product_name, quantity FROM order_items WHERE order_id = $1`,
            [ord.id]
          );
          if (itemsRes.rows.length > 0) {
            const pickListId = crypto.randomUUID();
            await Database.query(
              `INSERT INTO pick_lists (id, order_id, order_number, customer_id, zone, status)
               VALUES ($1, $2, $3, $4, 'Zone A-01-R1', 'GENERATED')
               ON CONFLICT DO NOTHING`,
              [pickListId, ord.id, ord.order_number, ord.customer_id]
            );

            for (const it of itemsRes.rows) {
              await Database.query(
                `INSERT INTO pick_items (id, pick_list_id, sku, product_name, quantity_requested, status)
                 VALUES ($1, $2, $3, $4, $5, 'PENDING')
                 ON CONFLICT DO NOTHING`,
                [crypto.randomUUID(), pickListId, it.sku, it.product_name, Math.round(parseFloat(it.quantity) || 1)]
              );
            }
          }
        }
      }

      // 2. Query all pick tasks joined with pick list metadata
      const tasksRes = await Database.query(`
        SELECT 
          pi.id,
          pl.order_number as "orderNumber",
          pi.sku,
          pi.product_name as "productName",
          pi.quantity_requested as "quantity",
          COALESCE(pl.zone, 'Zone A-01-R1') as "zone",
          pi.status,
          NULL as "substituteSku",
          NULL as "substituteDecision"
        FROM pick_items pi
        JOIN pick_lists pl ON pi.pick_list_id = pl.id
        ORDER BY pl.created_at DESC, pi.created_at ASC
        LIMIT 100
      `);

      res.status(200).json(okResponse(tasksRes.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Update Pick Item Status (e.g. Mark Picked)
  app.post('/api/v1/fulfillment/tasks/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const taskId = req.params.id as string;
      const { status } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(
        `UPDATE pick_items SET status = $1, quantity_picked = quantity_requested WHERE id = $2`,
        [status || 'PICKED', taskId]
      );

      res.status(200).json(okResponse({ id: taskId, status: status || 'PICKED' }, correlationId));
    } catch (err) {
      next(err);
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

import { claimDelivery, DeliveryClaimError } from './delivery.claim.js';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import Redis from 'ioredis';
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

      // 2. Query all active pick tasks joined with pick list and order metadata
      const tasksRes = await Database.query(`
        SELECT 
          pi.id,
          pl.order_number as "orderNumber",
          pi.sku,
          pi.product_name as "productName",
          pi.quantity_requested as "quantity",
          COALESCE(pl.zone, 'Zone A-01-R1') as "zone",
          pi.status,
          o.id as "orderId",
          o.status as "orderStatus",
          o.ready_for_pickup as "readyForPickup",
          NULL as "substituteSku",
          NULL as "substituteDecision"
        FROM pick_items pi
        JOIN pick_lists pl ON pi.pick_list_id = pl.id
        LEFT JOIN orders o ON pl.order_id = o.id OR pl.order_number = o.order_number
        WHERE o.status IS NULL OR o.status NOT IN ('DELIVERED', 'CANCELLED')
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

  // Feature 9: Barcode / QR Code Scanner Verification Endpoint for Picking & Packing
  app.post('/api/v1/fulfillment/scan', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { barcode, taskId, orderNumber } = req.body || {};

      if (!barcode || typeof barcode !== 'string') {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'Scanned barcode string is required', correlationId));
      }

      const cleanBarcode = barcode.trim().toUpperCase();

      // 1. Locate matching pending pick item
      let query = `
        SELECT 
          pi.id,
          pi.pick_list_id as "pickListId",
          pi.sku,
          pi.product_name as "productName",
          pi.quantity_requested as "quantityRequested",
          pi.quantity_picked as "quantityPicked",
          pi.status,
          pl.order_id as "orderId",
          pl.order_number as "orderNumber",
          pl.zone
        FROM pick_items pi
        JOIN pick_lists pl ON pi.pick_list_id = pl.id
        WHERE pi.status = 'PENDING'
      `;
      const params: any[] = [];

      if (taskId) {
        params.push(taskId);
        query += ` AND pi.id = $${params.length}`;
      } else if (orderNumber) {
        params.push(orderNumber);
        query += ` AND pl.order_number = $${params.length}`;
      }

      // Add barcode matching condition
      params.push(cleanBarcode);
      query += ` AND (UPPER(pi.sku) = $${params.length} OR UPPER(pi.sku) LIKE ('%' || $${params.length} || '%') OR UPPER(pi.product_name) LIKE ('%' || $${params.length} || '%'))`;
      query += ` ORDER BY pi.created_at ASC LIMIT 1`;

      const matchRes = await Database.query(query, params);

      // If no match found under the specific criteria
      if (matchRes.rows.length === 0) {
        // Check if item was ALREADY picked
        let alreadyQuery = `
          SELECT pi.id, pi.product_name as "productName", pi.sku, pi.status
          FROM pick_items pi
          JOIN pick_lists pl ON pi.pick_list_id = pl.id
          WHERE pi.status = 'PICKED'
        `;
        const alreadyParams: any[] = [];
        if (orderNumber) {
          alreadyParams.push(orderNumber);
          alreadyQuery += ` AND pl.order_number = $${alreadyParams.length}`;
        }
        alreadyParams.push(cleanBarcode);
        alreadyQuery += ` AND (UPPER(pi.sku) = $${alreadyParams.length} OR UPPER(pi.product_name) LIKE ('%' || $${alreadyParams.length} || '%')) LIMIT 1`;
        
        const alreadyRes = await Database.query(alreadyQuery, alreadyParams);
        if (alreadyRes.rows.length > 0) {
          return res.status(200).json(okResponse({
            matched: true,
            alreadyPicked: true,
            item: alreadyRes.rows[0],
            message: `Item "${alreadyRes.rows[0].productName}" was already verified and picked.`,
          }, correlationId));
        }

        return res.status(400).json(errorResponse(
          'BARCODE_MISMATCH',
          `Scanned barcode "${cleanBarcode}" does not match any pending items for this order.`,
          correlationId,
          { scannedBarcode: cleanBarcode, orderNumber }
        ));
      }

      const item = matchRes.rows[0];

      // 2. Mark item as PICKED
      await Database.query(`
        UPDATE pick_items 
        SET status = 'PICKED', quantity_picked = quantity_requested
        WHERE id = $1
      `, [item.id]);

      // 3. Check remaining items in this pick list
      const remainingRes = await Database.query(`
        SELECT COUNT(*) as count 
        FROM pick_items 
        WHERE pick_list_id = $1 AND status != 'PICKED'
      `, [item.pickListId]);

      const remainingCount = parseInt(remainingRes.rows[0]?.count || '0', 10);
      const isOrderComplete = remainingCount === 0;
      let bagSealCode: string | null = null;

      if (isOrderComplete) {
        bagSealCode = `BAG-${item.orderNumber}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        // Mark pick list as COMPLETED
        await Database.query(`
          UPDATE pick_lists 
          SET status = 'COMPLETED', updated_at = NOW() 
          WHERE id = $1
        `, [item.pickListId]).catch(() => {});

        // Mark authoritative order as PACKED & READY FOR PICKUP so it appears on Rider Dispatch immediately
        await Database.query(`
          UPDATE orders 
          SET status = 'PACKED', ready_for_pickup = TRUE, ready_for_pickup_at = NOW(), updated_at = NOW() 
          WHERE id = $1 OR order_number = $2
        `, [item.orderId, item.orderNumber]).catch(() => {});

        try {
          broadcastDeliveryEvent({
            type: 'ORDER_READY',
            orderId: item.orderId,
            orderNumber: item.orderNumber,
            timestamp: new Date().toISOString()
          });
        } catch {}

        logger.info('Order completed picking & packing via Barcode Scanner', {
          orderNumber: item.orderNumber,
          bagSealCode,
        });
      }

      res.status(200).json(okResponse({
        matched: true,
        alreadyPicked: false,
        item: {
          ...item,
          status: 'PICKED',
          quantityPicked: item.quantityRequested,
        },
        remainingItemsCount: remainingCount,
        isOrderComplete,
        bagSealCode,
        message: isOrderComplete
          ? `Order #${item.orderNumber} successfully picked and packed! Bag sealed with ${bagSealCode}.`
          : `Verified ${item.productName}. ${remainingCount} item(s) remaining to pack.`,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature 9: Dedicated Order Pick-List by Order Number for Picker Mobile/Handheld Scanner
  app.get('/api/v1/fulfillment/orders/:orderNumber/pick-list', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const orderNumber = req.params.orderNumber as string;
      const cleanOrderNumber = (orderNumber || '').replace(/^#/, '').trim();

      let pickListRes = await Database.query(`
        SELECT 
          pl.id as "pickListId",
          pl.order_id as "orderId",
          pl.order_number as "orderNumber",
          pl.customer_id as "customerId",
          pl.status as "pickListStatus",
          pl.zone,
          o.grand_total as "grandTotal",
          o.status as "orderStatus",
          o.ready_for_pickup as "readyForPickup",
          o.ready_for_pickup_at as "readyForPickupAt",
          da.rider_id as "assignedRiderId",
          da.rider_name as "assignedRiderName",
          da.rider_phone as "assignedRiderPhone",
          da.status as "deliveryStatus",
          da.delivery_otp as "deliveryOtp",
          da.assigned_at as "assignedAt"
        FROM pick_lists pl
        LEFT JOIN orders o ON pl.order_id = o.id OR pl.order_number = o.order_number
        LEFT JOIN delivery_assignments da ON (o.id = da.order_id OR pl.order_id = da.order_id OR o.order_number = da.order_number) AND da.status != 'CANCELLED'
        WHERE pl.order_number = $1 OR pl.order_number = $2 OR REPLACE(pl.order_number, '#', '') = $2 OR pl.order_id::text = $2
        ORDER BY da.created_at DESC NULLS LAST
        LIMIT 1
      `, [orderNumber, cleanOrderNumber]);

      if (pickListRes.rows.length === 0) {
        // Look up in orders table and auto-generate pick list
        const ordRes = await Database.query(`
          SELECT o.id, o.order_number, o.customer_id, o.grand_total, o.status, o.ready_for_pickup, o.ready_for_pickup_at
          FROM orders o
          WHERE o.id::text = $1 OR o.order_number = $1 OR o.order_number = $2
          LIMIT 1
        `, [orderNumber, cleanOrderNumber]);

        if (ordRes.rows.length === 0) {
          return res
            .status(404)
            .json(errorResponse('NOT_FOUND', `No pick list or order found for ${orderNumber}`, correlationId));
        }

        const ord = ordRes.rows[0];
        const newPlId = crypto.randomUUID();
        await Database.query(`
          INSERT INTO pick_lists (id, order_id, order_number, customer_id, zone, status)
          VALUES ($1, $2, $3, $4, 'Zone A-01-R1', 'GENERATED')
          ON CONFLICT DO NOTHING
        `, [newPlId, ord.id, ord.order_number, ord.customer_id || 'cust_default']);

        // Insert items from order_items
        const oiRes = await Database.query(`
          SELECT sku, product_name, quantity FROM order_items WHERE order_id = $1
        `, [ord.id]);

        for (const item of oiRes.rows) {
          await Database.query(`
            INSERT INTO pick_items (id, pick_list_id, sku, product_name, quantity_requested, quantity_picked, status)
            VALUES ($1, $2, $3, $4, $5, 0, 'PENDING')
          `, [crypto.randomUUID(), newPlId, item.sku, item.product_name, item.quantity]);
        }

        // Re-query newly created pick list
        pickListRes = await Database.query(`
          SELECT 
            pl.id as "pickListId",
            pl.order_id as "orderId",
            pl.order_number as "orderNumber",
            pl.customer_id as "customerId",
            pl.status as "pickListStatus",
            pl.zone,
            o.grand_total as "grandTotal",
            o.status as "orderStatus",
            o.ready_for_pickup as "readyForPickup",
            o.ready_for_pickup_at as "readyForPickupAt",
            da.rider_id as "assignedRiderId",
            da.rider_name as "assignedRiderName",
            da.rider_phone as "assignedRiderPhone",
            da.status as "deliveryStatus",
            da.delivery_otp as "deliveryOtp",
            da.assigned_at as "assignedAt"
          FROM pick_lists pl
          LEFT JOIN orders o ON pl.order_id = o.id OR pl.order_number = o.order_number
          LEFT JOIN delivery_assignments da ON (o.id = da.order_id OR pl.order_id = da.order_id OR o.order_number = da.order_number) AND da.status != 'CANCELLED'
          WHERE pl.id = $1
          ORDER BY da.created_at DESC NULLS LAST
          LIMIT 1
        `, [newPlId]);
      }

      const pickList = pickListRes.rows[0];

      const itemsRes = await Database.query(`
        SELECT 
          id,
          sku,
          product_name as "productName",
          quantity_requested as "quantityRequested",
          quantity_picked as "quantityPicked",
          batch_number as "batchNumber",
          expiry_date as "expiryDate",
          status
        FROM pick_items
        WHERE pick_list_id = $1
        ORDER BY status ASC, created_at ASC
      `, [pickList.pickListId]);

      const items = itemsRes.rows;
      const totalItems = items.length;
      const pickedItems = items.filter((it: any) => it.status === 'PICKED').length;
      const progressPercent = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;

      res.status(200).json(okResponse({
        pickList,
        items,
        totalItems,
        pickedItems,
        progressPercent,
        isCompleted: pickedItems === totalItems && totalItems > 0,
      }, correlationId));
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

      // Proactive WhatsApp notification to customer to collect substitute decision
      try {
        const plRes = await Database.query(`SELECT order_number FROM pick_lists WHERE id = $1`, [pickListId]);
        const orderNumber = plRes.rows[0]?.order_number;
        if (orderNumber) {
          const ordRes = await Database.query(`SELECT delivery_address FROM orders WHERE order_number = $1`, [orderNumber]);
          const addr = ordRes.rows[0]?.delivery_address || {};
          const phone = addr.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `⚠️ *FreshCart Item Substitution Alert for Order #${orderNumber}*\n\n` +
                  `Item *"${originalSku}"* is currently out of stock.\n` +
                  `Suggested Replacement: *${proposedProductName}* (${Number(priceDelta) >= 0 ? `+₹${Number(priceDelta).toFixed(2)}` : `-₹${Math.abs(Number(priceDelta)).toFixed(2)}`})\n\n` +
                  `Would you like to accept this item or receive a refund for it?\n` +
                  `Reply *APPROVE ${result.proposalId.slice(0, 8)}* or *REJECT ${result.proposalId.slice(0, 8)}* to decide.`,
              }),
            }).catch(() => {});
          }
        }
      } catch {}

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

  // ====================================================================
  // FEATURE 10: BATCH PICKING AND WAVE FULFILLMENT (MICRO-WAREHOUSE AGGREGATION)
  // ====================================================================

  Database.query(`
    CREATE TABLE IF NOT EXISTS fulfillment_waves (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wave_number VARCHAR(32) NOT NULL UNIQUE,
      zone VARCHAR(64) NOT NULL DEFAULT 'ZONE_A',
      status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_items INTEGER NOT NULL DEFAULT 0,
      picker_id VARCHAR(64),
      picker_name VARCHAR(128),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wave_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wave_id UUID NOT NULL,
      order_id UUID NOT NULL,
      order_number VARCHAR(32) NOT NULL,
      tote_number VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wave_pick_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wave_id UUID NOT NULL,
      sku VARCHAR(64) NOT NULL,
      product_name VARCHAR(128) NOT NULL,
      total_quantity_requested INTEGER NOT NULL DEFAULT 1,
      quantity_picked INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      aisle_bay VARCHAR(32) DEFAULT 'A-01-R',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `).catch((err: any) => {
    logger.warn('wave fulfillment tables init notice', { error: err.message });
  });

  // 1. List all waves
  app.get('/api/v1/fulfillment/waves', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const wavesRes = await Database.query(`
        SELECT id, wave_number as "waveNumber", zone, status,
               total_orders as "totalOrders", total_items as "totalItems",
               picker_name as "pickerName", started_at as "startedAt",
               completed_at as "completedAt", created_at as "createdAt"
        FROM fulfillment_waves
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const waves = await Promise.all(
        wavesRes.rows.map(async (w: any) => {
          const itemsRes = await Database.query(
            `SELECT id, sku, product_name as "productName",
                    total_quantity_requested as "totalQuantityRequested",
                    quantity_picked as "quantityPicked", status, aisle_bay as "aisleBay"
             FROM wave_pick_items WHERE wave_id = $1 ORDER BY status ASC, sku ASC`,
            [w.id]
          );
          const ordersRes = await Database.query(
            `SELECT id, order_id as "orderId", order_number as "orderNumber",
                    tote_number as "toteNumber", status
             FROM wave_orders WHERE wave_id = $1 ORDER BY tote_number ASC`,
            [w.id]
          );
          return {
            ...w,
            items: itemsRes.rows,
            orders: ordersRes.rows,
          };
        })
      );

      res.status(200).json(okResponse({ waves }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Generate new Wave from pending unassigned orders
  app.post('/api/v1/fulfillment/waves/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { zone = 'ZONE_A', maxOrders = 6, pickerName = 'DarkStore Wave Picker' } = req.body || {};

      // Find open orders that are not already part of an active wave
      const eligibleOrdersRes = await Database.query(`
        SELECT o.id as "orderId", o.order_number as "orderNumber"
        FROM orders o
        JOIN pick_lists pl ON o.id = pl.order_id
        LEFT JOIN wave_orders wo ON o.id = wo.order_id
        WHERE pl.status IN ('GENERATED', 'ASSIGNED')
          AND o.status IN ('AWAITING_PAYMENT', 'CONFIRMED')
          AND wo.id IS NULL
        LIMIT $1
      `, [maxOrders]);

      if (eligibleOrdersRes.rows.length === 0) {
        return res.status(400).json(errorResponse('NO_ELIGIBLE_ORDERS', 'No pending unassigned orders available to bundle into a wave.', correlationId));
      }

      const ordersToBatch = eligibleOrdersRes.rows;
      const waveId = crypto.randomUUID();
      const waveNumber = `WAVE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // Aggregate item quantities across these orders
      const orderIds = ordersToBatch.map((o: any) => o.orderId);
      const aggItemsRes = await Database.query(`
        SELECT pi.sku, pi.product_name as "productName", SUM(pi.quantity_requested)::int as "totalQuantity"
        FROM pick_items pi
        JOIN pick_lists pl ON pi.pick_list_id = pl.id
        WHERE pl.order_id = ANY($1)
        GROUP BY pi.sku, pi.product_name
        ORDER BY pi.sku ASC
      `, [orderIds]);

      const aggregatedItems = aggItemsRes.rows;
      const totalItemsCount = aggregatedItems.reduce((sum: number, it: any) => sum + it.totalQuantity, 0);

      // Create Wave Master
      await Database.query(`
        INSERT INTO fulfillment_waves (id, wave_number, zone, status, total_orders, total_items, picker_name, started_at)
        VALUES ($1, $2, $3, 'IN_PROGRESS', $4, $5, $6, NOW())
      `, [waveId, waveNumber, zone, ordersToBatch.length, totalItemsCount, pickerName]);

      // Assign Totes to Orders
      for (let i = 0; i < ordersToBatch.length; i++) {
        const ord = ordersToBatch[i];
        const toteNumber = `TOTE-${String.fromCharCode(65 + Math.floor(i / 10))}${((i % 10) + 1).toString().padStart(2, '0')}`;
        await Database.query(`
          INSERT INTO wave_orders (wave_id, order_id, order_number, tote_number, status)
          VALUES ($1, $2, $3, $4, 'ASSIGNED')
        `, [waveId, ord.orderId, ord.orderNumber, toteNumber]);
      }

      // Insert aggregated pick lines
      const AISLES = ['A-01-R', 'A-02-L', 'B-01-R', 'B-03-L', 'C-02-R', 'D-01-L'];
      for (let i = 0; i < aggregatedItems.length; i++) {
        const it = aggregatedItems[i];
        const aisle = AISLES[i % AISLES.length];
        await Database.query(`
          INSERT INTO wave_pick_items (wave_id, sku, product_name, total_quantity_requested, quantity_picked, status, aisle_bay)
          VALUES ($1, $2, $3, $4, 0, 'PENDING', $5)
        `, [waveId, it.sku, it.productName, it.totalQuantity, aisle]);
      }

      res.status(201).json(okResponse({
        waveId,
        waveNumber,
        zone,
        totalOrders: ordersToBatch.length,
        totalItems: totalItemsCount,
        orders: ordersToBatch,
        aggregatedItemsCount: aggregatedItems.length,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Pick item in Wave (Picker scans/picks consolidated SKU)
  app.post('/api/v1/fulfillment/waves/:id/pick-item', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { sku } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!sku) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'sku is required', correlationId));
      }

      const itemRes = await Database.query(`
        SELECT id, sku, product_name as "productName", total_quantity_requested as "totalQty", quantity_picked as "qtyPicked"
        FROM wave_pick_items
        WHERE wave_id = $1 AND UPPER(sku) = UPPER($2)
        LIMIT 1
      `, [id, sku]);

      if (itemRes.rows.length === 0) {
        return res.status(404).json(errorResponse('NOT_FOUND', `SKU ${sku} not found in this wave`, correlationId));
      }

      const item = itemRes.rows[0];
      const newPickedQty = item.totalQty;

      await Database.query(`
        UPDATE wave_pick_items
        SET quantity_picked = $1, status = 'PICKED'
        WHERE id = $2
      `, [newPickedQty, item.id]);

      // Also query which tote boxes get this SKU
      const totesRes = await Database.query(`
        SELECT wo.tote_number as "toteNumber", wo.order_number as "orderNumber", pi.quantity_requested as "quantity"
        FROM wave_orders wo
        JOIN pick_lists pl ON wo.order_id = pl.order_id
        JOIN pick_items pi ON pl.id = pi.pick_list_id
        WHERE wo.wave_id = $1 AND UPPER(pi.sku) = UPPER($2)
      `, [id, sku]);

      // Check if entire wave is now picked
      const remRes = await Database.query(`
        SELECT COUNT(*)::int as remaining FROM wave_pick_items WHERE wave_id = $1 AND status = 'PENDING'
      `, [id]);
      const isWaveComplete = (remRes.rows[0]?.remaining || 0) === 0;

      res.status(200).json(okResponse({
        sku: item.sku,
        productName: item.productName,
        totalQuantityPicked: newPickedQty,
        sortToTotes: totesRes.rows,
        isWaveComplete,
        message: `Picked ${newPickedQty}x ${item.productName}. Sort into customer totes!`,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. Complete Wave and automatically transition all batched orders to PACKED
  app.post('/api/v1/fulfillment/waves/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(`
        UPDATE fulfillment_waves
        SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // Mark all wave items picked
      await Database.query(`
        UPDATE wave_pick_items
        SET quantity_picked = total_quantity_requested, status = 'PICKED'
        WHERE wave_id = $1
      `, [id]);

      // Update associated pick lists & orders to PACKED
      const ordersRes = await Database.query(`
        SELECT order_id as "orderId", order_number as "orderNumber" FROM wave_orders WHERE wave_id = $1
      `, [id]);

      for (const ord of ordersRes.rows) {
        await Database.query(`
          UPDATE pick_lists SET status = 'PACKED' WHERE order_id = $1
        `, [ord.orderId]);
        await Database.query(`
          UPDATE pick_items SET status = 'PICKED' WHERE pick_list_id IN (SELECT id FROM pick_lists WHERE order_id = $1)
        `, [ord.orderId]);
        await Database.query(`
          UPDATE orders SET status = 'PACKED' WHERE id = $1
        `, [ord.orderId]);
      }

      res.status(200).json(okResponse({
        waveId: id,
        status: 'COMPLETED',
        completedOrdersCount: ordersRes.rows.length,
        message: `Wave completed! ${ordersRes.rows.length} order(s) sorted, sealed, and ready for rider pickup.`,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // ====================================================================
  // FEATURE 6 & 7: RIDER / DELIVERY PARTNER FLEET & LIVE TRACKING API
  // ====================================================================

  // Ensure delivery_assignments and delivery_riders tables exist gracefully
  Database.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS delivery_riders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(128) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(128),
      status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
      vehicle_type VARCHAR(32) NOT NULL DEFAULT 'EV_2W',
      vehicle_number VARCHAR(32) NOT NULL,
      driving_license VARCHAR(64) NOT NULL,
      dark_store_id UUID,
      dark_store_name VARCHAR(128) DEFAULT 'Dark Store #04 - HSR Sector 2',
      kyc_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
      current_lat NUMERIC(10, 6) DEFAULT 12.914142,
      current_lng NUMERIC(10, 6) DEFAULT 77.641151,
      last_active_at TIMESTAMPTZ DEFAULT NOW(),
      total_orders_completed INTEGER DEFAULT 0,
      earnings_today NUMERIC(10, 2) DEFAULT 0.00,
      cod_collected_today NUMERIC(10, 2) DEFAULT 0.00,
      rating NUMERIC(3, 2) DEFAULT 5.00,
      pin_code VARCHAR(6) DEFAULT '1234',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS delivery_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      order_number VARCHAR(32) NOT NULL,
      rider_id VARCHAR(64) NOT NULL,
      rider_name VARCHAR(128) NOT NULL,
      rider_phone VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED',
      current_lat NUMERIC(10, 6) DEFAULT 12.914142,
      current_lng NUMERIC(10, 6) DEFAULT 77.641151,
      estimated_arrival_minutes INTEGER DEFAULT 12,
      delivery_address JSONB,
      delivery_otp VARCHAR(8),
      rider_uuid UUID,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      dispatched_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      proof_signature TEXT,
      proof_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(8);
    ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS rider_uuid UUID;

    -- Seed initial riders with cryptographic salted password hash
    INSERT INTO delivery_riders (id, full_name, phone, email, password_hash, status, vehicle_type, vehicle_number, driving_license, dark_store_name, pin_code, rating, total_orders_completed, earnings_today)
    VALUES 
      ('a0000000-0000-0000-0000-000000000001', 'Rahul Sharma', '+91 98765 00112', 'rahul.rider@freshcart.in', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:881feecad21371989a4e9385a5f4d1bd851f9a05fe562b738b9e2b59b6b85862', 'ONLINE', 'EV_2W', 'KA-05-EQ-4412', 'DL-04-2022-88192', 'Dark Store #04 - HSR Sector 2', '1234', 4.90, 8, 760.00),
      ('a0000000-0000-0000-0000-000000000002', 'Vikram Singh', '+91 98765 00113', 'vikram.rider@freshcart.in', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:881feecad21371989a4e9385a5f4d1bd851f9a05fe562b738b9e2b59b6b85862', 'ONLINE', 'MOTORCYCLE', 'KA-01-AB-1299', 'DL-01-2021-44710', 'Dark Store #04 - HSR Sector 2', '1234', 4.85, 5, 450.00)
    ON CONFLICT (phone) DO NOTHING;

    -- Ensure any existing riders have cryptographic password hash populated
    UPDATE delivery_riders 
    SET password_hash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90:881feecad21371989a4e9385a5f4d1bd851f9a05fe562b738b9e2b59b6b85862'
    WHERE password_hash IS NULL AND pin_code = '1234';
  `).catch((err: any) => {
    logger.warn('delivery_riders and assignments init notice', { error: err.message });
  });

  // ====================================================================
  // REAL-TIME ORDER & DELIVERY SSE BROADCAST MANAGER (REDIS PUB/SUB SYNC)
  // Architectural Flaw Fix (Flaw 3): Synchronizes rider locations and delivery events across all scaled instances
  // ====================================================================
  type SSEClient = { id: string; res: Response; riderId?: string };
  const sseClients: Map<string, SSEClient> = new Map();

  const REDIS_CHANNEL = 'freshcart:delivery:events';
  let redisPub: any = null;
  let redisSub: any = null;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redisPub = new (Redis as any)(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
      redisSub = new (Redis as any)(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });

      redisSub.subscribe(REDIS_CHANNEL, (err: any) => {
        if (!err) logger.info('Subscribed to Redis Pub/Sub for distributed SSE broadcast');
      });

      redisSub.on('message', (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          const data = `data: ${JSON.stringify(parsed)}\n\n`;
          for (const [id, client] of sseClients) {
            try { client.res.write(data); } catch { sseClients.delete(id); }
          }
        } catch {}
      });

      redisPub.on('error', () => {});
      redisSub.on('error', () => {});
    } catch {
      redisPub = null;
      redisSub = null;
    }
  }

  function broadcastDeliveryEvent(event: any) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const [id, client] of sseClients) {
      try {
        client.res.write(data);
      } catch (err) {
        sseClients.delete(id);
      }
    }
    // Synchronize to other horizontal instances via Redis Pub/Sub
    if (redisPub) {
      try {
        redisPub.publish(REDIS_CHANNEL, JSON.stringify(event)).catch(() => {});
      } catch {}
    }
  }

  // Haversine distance calculation in kilometers
  function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  const STORE_LOCATION = {
    name: 'Dark Store #04 - HSR Sector 2',
    address: '12th Main Road, HSR Sector 2, Bengaluru 560102',
    lat: 12.914142,
    lng: 77.641151
  };

  // SSE Stream endpoint for real-time delivery notifications
  app.get('/api/v1/fulfillment/deliveries/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    const clientId = crypto.randomUUID();
    const riderId = req.query.riderId as string;
    sseClients.set(clientId, { id: clientId, res, riderId });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, timestamp: new Date().toISOString() })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(clientId);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  // ====================================================================
  // DEDICATED DELIVERY PARTNER AUTHENTICATION & ENROLLMENT
  // ====================================================================

  // Dedicated Delivery Partner Registration
  app.post(['/api/v1/fulfillment/delivery-partners/register', '/api/v1/auth/delivery/register'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const {
        fullName,
        phone,
        email,
        password,
        pinCode,
        vehicleType,
        vehicleNumber,
        drivingLicense,
        darkStoreName,
        emergencyContact,
        bloodGroup,
        panNumber,
        aadharNumber
      } = req.body || {};

      if (!fullName || !phone || !vehicleNumber || !drivingLicense) {
        return res.status(400).json(errorResponse(
          'INVALID_PARAM',
          'Full Name, Mobile Number, Vehicle Registration Number, and Driving License are required for enrollment.',
          correlationId
        ));
      }

      // Check if phone or email already registered
      const cleanPhone = phone.trim();
      const strippedPhone = cleanPhone.replace(/^(\+91)/, '').replace(/\s+/g, '');
      const existing = await Database.query(
        `SELECT id FROM delivery_riders 
         WHERE phone = $1 
            OR phone = $2 
            OR REPLACE(phone, ' ', '') = $3 
            OR (email IS NOT NULL AND LOWER(email) = LOWER($4))`,
        [cleanPhone, strippedPhone, strippedPhone, email ? email.trim() : null]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json(errorResponse(
          'PARTNER_EXISTS',
          'A delivery partner with this mobile number or email is already registered. Please sign in.',
          correlationId
        ));
      }

      const id = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(password || pinCode || '1234', salt, 32).toString('hex');
      const passwordHash = `${salt}:${hash}`;

      const result = await Database.query(`
        INSERT INTO delivery_riders (
          id, full_name, phone, email, password_hash, pin_code,
          vehicle_type, vehicle_number, driving_license,
          dark_store_name, emergency_contact, blood_group,
          pan_number, aadhar_number, status, approval_status,
          kyc_status, role, rating, total_orders_completed,
          earnings_today, cod_collected_today, total_earnings_all_time,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          'ONLINE', 'APPROVED', 'VERIFIED', 'DELIVERY_PARTNER', 5.00, 0,
          0.00, 0.00, 0.00, NOW(), NOW()
        )
        RETURNING *
      `, [
        id,
        fullName.trim(),
        cleanPhone,
        email ? email.trim().toLowerCase() : null,
        passwordHash,
        pinCode || '1234',
        vehicleType || 'EV_2W',
        vehicleNumber.trim().toUpperCase(),
        drivingLicense.trim().toUpperCase(),
        darkStoreName || 'Dark Store #04 - HSR Sector 2, Bengaluru',
        emergencyContact || null,
        bloodGroup || null,
        panNumber ? panNumber.trim().toUpperCase() : null,
        aadharNumber ? aadharNumber.trim() : null
      ]);

      const partner = result.rows[0];
      delete partner.password_hash;

      const token = `dp_token_${partner.id}_${Date.now()}`;
      logger.info('New delivery partner registered successfully', { id: partner.id, fullName: partner.full_name, phone: partner.phone });

      broadcastDeliveryEvent({
        type: 'RIDER_STATUS_CHANGED',
        riderId: partner.id,
        status: 'ONLINE',
        timestamp: new Date().toISOString()
      });

      res.status(201).json(okResponse({
        partner,
        token,
        role: 'DELIVERY_PARTNER',
        message: `Welcome to FreshCart Fleet, ${partner.full_name}! Your account has been verified and is ready for deliveries.`
      }, correlationId));
    } catch (err: any) {
      if (err.code === '23505') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res.status(409).json(errorResponse('PARTNER_EXISTS', 'A delivery partner with this phone number already exists', correlationId));
      }
      next(err);
    }
  });

  // Dedicated Delivery Partner Login
  app.post(['/api/v1/fulfillment/delivery-partners/login', '/api/v1/auth/delivery/login'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { phoneOrEmail, phone, identifier: rawId, password, pinCode } = req.body || {};
      const identifier = (phoneOrEmail || phone || rawId || '').trim();

      if (!identifier) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'Mobile number or email is required to sign in', correlationId));
      }

      const strippedPhone = identifier.replace(/^(\+91)/, '').replace(/\s+/g, '');

      const result = await Database.query(`
        SELECT * FROM delivery_riders 
        WHERE phone = $1 
           OR phone = $2 
           OR REPLACE(phone, ' ', '') = $3
           OR (email IS NOT NULL AND LOWER(email) = LOWER($1))
        LIMIT 1
      `, [identifier, strippedPhone, strippedPhone]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse(
          'PARTNER_NOT_FOUND',
          'No delivery partner registered with these credentials. Please check or register as a new partner.',
          correlationId
        ));
      }

      const partner = result.rows[0];

      if (partner.approval_status === 'REJECTED') {
        return res.status(403).json(errorResponse('ACCOUNT_SUSPENDED', 'Your delivery partner account has been suspended. Please contact store management.', correlationId));
      }

      // Password / PIN verification strictly against salted hash or assigned PIN
      let passwordValid = false;
      const testInput = String(password || pinCode || '').trim();

      if (testInput && partner.password_hash) {
        const [salt, storedHash] = partner.password_hash.split(':');
        if (salt && storedHash) {
          const testHash = crypto.scryptSync(testInput, salt, 32).toString('hex');
          if (testHash === storedHash) passwordValid = true;
        }
      }
      if (!passwordValid && testInput && partner.pin_code) {
        if (testInput === String(partner.pin_code).trim()) {
          passwordValid = true;
        }
      }

      if (!passwordValid) {
        return res.status(401).json(errorResponse('INVALID_CREDENTIALS', 'Invalid password or 4-digit security PIN', correlationId));
      }

      // Mark partner ONLINE upon login
      await Database.query(`UPDATE delivery_riders SET status = 'ONLINE', last_active_at = NOW(), updated_at = NOW() WHERE id = $1`, [partner.id]);
      partner.status = 'ONLINE';
      delete partner.password_hash;

      broadcastDeliveryEvent({
        type: 'RIDER_STATUS_CHANGED',
        riderId: partner.id,
        status: 'ONLINE',
        timestamp: new Date().toISOString()
      });

      const token = `dp_token_${partner.id}_${Date.now()}`;
      res.status(200).json(okResponse({
        partner,
        token,
        role: 'DELIVERY_PARTNER',
        message: `Welcome back, ${partner.full_name}!`
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Delivery Partner Me / Profile
  app.get('/api/v1/fulfillment/delivery-partners/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const authHeader = (req.headers.authorization || '') as string;
      const tokenRiderId = authHeader.startsWith('Bearer dp_token_')
        ? authHeader.replace('Bearer dp_token_', '').split('_')[0]
        : null;

      const riderId = (req.query.partnerId || req.headers['x-user-id'] || tokenRiderId || req.query.riderId) as string;

      if (!riderId) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'Delivery partner ID is required', correlationId));
      }

      const result = await Database.query(
        `SELECT id, full_name, phone, email, status, vehicle_type, vehicle_number, driving_license,
                dark_store_name, emergency_contact, blood_group, approval_status, kyc_status,
                rating, total_orders_completed, earnings_today, cod_collected_today, total_earnings_all_time,
                current_lat, current_lng, last_active_at
         FROM delivery_riders WHERE id::text = $1 OR phone = $1 LIMIT 1`,
        [riderId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse('PARTNER_NOT_FOUND', 'Delivery partner not found', correlationId));
      }

      res.status(200).json(okResponse(result.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // List all registered riders (Storekeeper View)
  app.get('/api/v1/fulfillment/riders', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const status = req.query.status as string;
      const query = status 
        ? `SELECT * FROM delivery_riders WHERE status = $1 ORDER BY full_name ASC`
        : `SELECT * FROM delivery_riders ORDER BY created_at DESC`;
      const params = status ? [status] : [];
      const result = await Database.query(query, params);
      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Storekeeper Onboards Rider (Alias to register)
  app.post('/api/v1/fulfillment/riders', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const {
        fullName,
        phone,
        email,
        vehicleType,
        vehicleNumber,
        drivingLicense,
        darkStoreName,
        pinCode
      } = req.body || {};

      if (!fullName || !phone || !vehicleNumber || !drivingLicense) {
        return res.status(400).json(errorResponse(
          'INVALID_PARAM',
          'fullName, phone, vehicleNumber, and drivingLicense are required to register a rider',
          correlationId
        ));
      }

      const id = crypto.randomUUID();
      const result = await Database.query(`
        INSERT INTO delivery_riders (
          id, full_name, phone, email, vehicle_type, vehicle_number, driving_license,
          dark_store_name, pin_code, status, kyc_status, rating, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OFFLINE', 'VERIFIED', 5.00, NOW(), NOW())
        RETURNING *
      `, [
        id,
        fullName.trim(),
        phone.trim(),
        email ? email.trim() : null,
        vehicleType || 'EV_2W',
        vehicleNumber.trim().toUpperCase(),
        drivingLicense.trim().toUpperCase(),
        darkStoreName || 'Dark Store #04 - HSR Sector 2, Bengaluru',
        pinCode || '1234'
      ]);

      logger.info('New delivery partner registered', { riderId: id, fullName, phone });
      res.status(201).json(okResponse(result.rows[0], correlationId));
    } catch (err: any) {
      if (err.code === '23505') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res.status(409).json(errorResponse('RIDER_EXISTS', 'A delivery partner with this phone number is already registered', correlationId));
      }
      next(err);
    }
  });

  // Rider Legacy Login
  app.post('/api/v1/fulfillment/riders/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { phone, pinCode } = req.body || {};

      if (!phone) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'Phone number is required', correlationId));
      }

      const result = await Database.query(`
        SELECT * FROM delivery_riders 
        WHERE phone = $1 OR phone = $2 OR REPLACE(phone, ' ', '') = REPLACE($1, ' ', '')
        LIMIT 1
      `, [phone.trim(), phone.trim().replace(/^(\+91)/, '').trim()]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse('RIDER_NOT_FOUND', 'No delivery partner registered with this phone number. Please register as a delivery partner.', correlationId));
      }

      const rider = result.rows[0];
      const testPin = String(pinCode || '').trim();
      let pinValid = false;

      if (testPin && rider.password_hash) {
        const [salt, storedHash] = rider.password_hash.split(':');
        if (salt && storedHash) {
          const testHash = crypto.scryptSync(testPin, salt, 32).toString('hex');
          if (testHash === storedHash) pinValid = true;
        }
      }
      if (!pinValid && testPin && rider.pin_code) {
        if (testPin === String(rider.pin_code).trim()) {
          pinValid = true;
        }
      }

      if (!pinValid) {
        return res.status(401).json(errorResponse('INVALID_PIN', 'Invalid 4-digit security PIN', correlationId));
      }

      await Database.query(`UPDATE delivery_riders SET status = 'ONLINE', last_active_at = NOW() WHERE id = $1`, [rider.id]);
      rider.status = 'ONLINE';
      delete rider.password_hash;

      broadcastDeliveryEvent({
        type: 'RIDER_STATUS_CHANGED',
        riderId: rider.id,
        status: 'ONLINE',
        timestamp: new Date().toISOString()
      });

      res.status(200).json(okResponse({
        rider,
        partner: rider,
        token: `rider_token_${rider.id}_${Date.now()}`,
        role: 'DELIVERY_PARTNER',
        message: `Welcome back, ${rider.full_name}!`
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Rider Toggle Duty Status (ONLINE / OFFLINE / ON_BREAK)
  app.patch(['/api/v1/fulfillment/riders/:id/duty', '/api/v1/fulfillment/delivery-partners/:id/duty'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!['ONLINE', 'OFFLINE', 'ON_BREAK', 'ON_DELIVERY'].includes(status)) {
        return res.status(400).json(errorResponse('INVALID_STATUS', 'Status must be ONLINE, OFFLINE, ON_BREAK, or ON_DELIVERY', correlationId));
      }

      const result = await Database.query(`
        UPDATE delivery_riders 
        SET status = $1, last_active_at = NOW(), updated_at = NOW()
        WHERE id::text = $2 OR phone = $2
        RETURNING *
      `, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse('RIDER_NOT_FOUND', 'Rider not found', correlationId));
      }

      const updated = result.rows[0];
      delete updated.password_hash;

      broadcastDeliveryEvent({
        type: 'RIDER_STATUS_CHANGED',
        riderId: updated.id,
        status,
        timestamp: new Date().toISOString()
      });

      res.status(200).json(okResponse(updated, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Rider updates live device GPS coordinates
  app.post('/api/v1/fulfillment/riders/:id/location', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!lat || !lng) {
        return res.status(400).json(errorResponse('INVALID_COORDINATES', 'Latitude and longitude are required', correlationId));
      }

      await Database.query(`
        UPDATE delivery_riders 
        SET current_lat = $1, current_lng = $2, last_active_at = NOW(), updated_at = NOW()
        WHERE id::text = $3 OR phone = $3
      `, [Number(lat), Number(lng), id]);

      // Also update any active delivery assigned to this rider
      await Database.query(`
        UPDATE delivery_assignments 
        SET current_lat = $1, current_lng = $2, updated_at = NOW()
        WHERE (rider_id = $3 OR rider_uuid::text = $3) AND status IN ('ASSIGNED', 'REACHED_STORE', 'PICKED_UP', 'IN_TRANSIT')
      `, [Number(lat), Number(lng), id]);

      res.status(200).json(okResponse({ lat, lng, updatedAt: new Date().toISOString() }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Reconcile / Settle Rider COD Cash (Storekeeper Action)
  app.post('/api/v1/fulfillment/riders/:id/cash-deposit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { amountDeposited } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const riderRes = await Database.query(`SELECT id, full_name, cod_collected_today FROM delivery_riders WHERE id::text = $1 OR phone = $1`, [id]);
      if (riderRes.rows.length === 0) {
        return res.status(404).json(errorResponse('RIDER_NOT_FOUND', 'Rider not found', correlationId));
      }
      const rider = riderRes.rows[0];
      const currentCod = parseFloat(rider.cod_collected_today) || 0;
      const deposit = parseFloat(amountDeposited) || currentCod;
      const newCod = Math.max(0, currentCod - deposit);

      await Database.query(`UPDATE delivery_riders SET cod_collected_today = $1, updated_at = NOW() WHERE id = $2`, [newCod, rider.id]);

      res.status(200).json(okResponse({
        riderId: rider.id,
        fullName: rider.full_name,
        amountDeposited: deposit,
        remainingCod: newCod,
        settledAt: new Date().toISOString()
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // ====================================================================
  // ORDER DISTRIBUTION & REAL-TIME DELIVERY DISPATCH
  // ====================================================================

  // Shopkeeper marks order "Ready for Delivery"
  app.post('/api/v1/fulfillment/orders/:orderId/ready-for-delivery', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId as string;
      const cleanId = (orderId || '').replace(/^#/, '').trim();
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const ordRes = await Database.query(
        `SELECT id, order_number, status, delivery_address, grand_total 
         FROM orders 
         WHERE id::text = $1 OR order_number = $1 OR order_number = $2`,
        [orderId, cleanId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }
      const order = ordRes.rows[0];

      // Check if order already has an active delivery assignment
      const daCheck = await Database.query(
        `SELECT id, rider_name, rider_phone, status FROM delivery_assignments 
         WHERE (order_id = $1 OR order_number = $2) AND status NOT IN ('CANCELLED') LIMIT 1`,
        [order.id, order.order_number]
      );
      if (daCheck.rows.length > 0) {
        const da = daCheck.rows[0];
        if (da.status === 'DELIVERED') {
          return res.status(200).json(okResponse({
            orderId: order.id,
            orderNumber: order.order_number,
            readyForPickup: true,
            alreadyDelivered: true,
            riderName: da.rider_name,
            riderPhone: da.rider_phone,
            deliveryStatus: da.status,
            message: `Order was already delivered by ${da.rider_name}.`
          }, correlationId));
        }

        return res.status(200).json(okResponse({
          orderId: order.id,
          orderNumber: order.order_number,
          readyForPickup: true,
          alreadyAssigned: true,
          riderName: da.rider_name,
          riderPhone: da.rider_phone,
          deliveryStatus: da.status,
          message: `Order is already assigned to rider ${da.rider_name} (${da.status}).`
        }, correlationId));
      }

      if (!['CONFIRMED', 'PICKING', 'PACKED'].includes(order.status)) {
        return res.status(409).json(errorResponse('ORDER_NOT_READY', 'Only confirmed orders can be packed for delivery.', correlationId));
      }

      // Mark order as ready for pickup and PACKED
      await Database.query(`
        UPDATE orders 
        SET ready_for_pickup = TRUE, 
            ready_for_pickup_at = NOW(),
            status = 'PACKED',
            updated_at = NOW()
        WHERE id = $1
      `, [order.id]);

      // Broadcast SSE event to all online delivery partners
      broadcastDeliveryEvent({
        type: 'ORDER_READY',
        orderId: order.id,
        orderNumber: order.order_number,
        grandTotal: order.grand_total,
        timestamp: new Date().toISOString()
      });

      res.status(200).json(okResponse({
        orderId: order.id,
        orderNumber: order.order_number,
        readyForPickup: true,
        message: 'Order is marked Ready for Delivery and broadcast to all online delivery partners'
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 1. Available orders ready for rider acceptance (Broadcast pool)
  app.get('/api/v1/fulfillment/deliveries/available', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const result = await Database.query(`
        SELECT 
          o.id as "orderId",
          o.order_number as "orderNumber",
          o.status as "orderStatus",
          o.grand_total as "grandTotal",
          o.delivery_address as "deliveryAddress",
          o.created_at as "createdAt",
          o.ready_for_pickup as "readyForPickup",
          o.ready_for_pickup_at as "readyForPickupAt",
          COUNT(oi.id) as "itemCount"
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN delivery_assignments da ON o.id = da.order_id AND da.status != 'CANCELLED'
        WHERE (o.ready_for_pickup = TRUE OR o.status = 'PACKED')
          AND (o.delivery_address->>'deliveryWindowStart' IS NULL OR (o.delivery_address->>'deliveryWindowStart')::timestamptz <= NOW())
          AND (o.delivery_address->>'deliveryWindowEnd' IS NULL OR (o.delivery_address->>'deliveryWindowEnd')::timestamptz > NOW())
          AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'DISPATCHED')
          AND da.id IS NULL
        GROUP BY o.id, o.order_number, o.status, o.grand_total, o.delivery_address, o.created_at, o.ready_for_pickup, o.ready_for_pickup_at
        ORDER BY COALESCE(o.ready_for_pickup_at, o.created_at) DESC
        LIMIT 100
      `);

      const enriched = result.rows.map(row => {
        const dropLat = row.deliveryAddress?.lat ? Number(row.deliveryAddress.lat) : 12.915523;
        const dropLng = row.deliveryAddress?.lng ? Number(row.deliveryAddress.lng) : 77.643218;
        const distanceKm = calculateHaversineDistanceKm(STORE_LOCATION.lat, STORE_LOCATION.lng, dropLat, dropLng);
        const etaMinutes = Math.max(8, Math.round((distanceKm / 20) * 60) + 4);
        const payout = Number((50 + Math.max(0, distanceKm - 2) * 10).toFixed(2));

        return {
          ...row,
          storeLocation: STORE_LOCATION,
          dropLocation: {
            lat: dropLat,
            lng: dropLng,
            address: `${row.deliveryAddress?.flat_number ? row.deliveryAddress.flat_number + ', ' : ''}${row.deliveryAddress?.street || ''}, ${row.deliveryAddress?.city || ''}`
          },
          distanceKm,
          estimatedMinutes: etaMinutes,
          estimatedPayout: payout
        };
      });

      res.status(200).json(okResponse(enriched, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Active deliveries for riders and dispatch overview
  app.get('/api/v1/fulfillment/deliveries/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const riderId = req.query.riderId as string;
      const conditions: string[] = ["da.status IN ('ASSIGNED', 'REACHED_STORE', 'PICKED_UP', 'IN_TRANSIT')"];
      const params: any[] = [];

      if (riderId) {
        params.push(riderId);
        conditions.push(`(da.rider_id = $${params.length} OR da.rider_uuid::text = $${params.length})`);
      }

      const result = await Database.query(`
        SELECT 
          da.id as "deliveryId",
          da.order_id as "orderId",
          da.order_number as "orderNumber",
          da.rider_id as "riderId",
          da.rider_name as "riderName",
          da.rider_phone as "riderPhone",
          da.status as "deliveryStatus",
          da.current_lat as "currentLat",
          da.current_lng as "currentLng",
          da.estimated_arrival_minutes as "etaMinutes",
          da.delivery_address as "deliveryAddress",
          da.delivery_otp as "deliveryOtp",
          da.assigned_at as "assignedAt",
          da.reached_store_at as "reachedStoreAt",
          da.dispatched_at as "dispatchedAt",
          o.grand_total as "grandTotal",
          o.status as "orderStatus"
        FROM delivery_assignments da
        JOIN orders o ON da.order_id = o.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY da.assigned_at DESC
      `, params);

      const enriched = result.rows.map(row => {
        const dropLat = row.deliveryAddress?.lat ? Number(row.deliveryAddress.lat) : 12.915523;
        const dropLng = row.deliveryAddress?.lng ? Number(row.deliveryAddress.lng) : 77.643218;
        const distanceKm = calculateHaversineDistanceKm(STORE_LOCATION.lat, STORE_LOCATION.lng, dropLat, dropLng);

        return {
          ...row,
          storeLocation: STORE_LOCATION,
          dropLocation: {
            lat: dropLat,
            lng: dropLng,
            address: `${row.deliveryAddress?.flat_number ? row.deliveryAddress.flat_number + ', ' : ''}${row.deliveryAddress?.street || ''}, ${row.deliveryAddress?.city || ''}`
          },
          distanceKm,
          estimatedPayout: Number((50 + Math.max(0, distanceKm - 2) * 10).toFixed(2))
        };
      });

      res.status(200).json(okResponse(enriched, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Completed deliveries for rider history & audit
  app.get('/api/v1/fulfillment/deliveries/completed', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const riderId = req.query.riderId as string;
      const conditions: string[] = ["da.status = 'DELIVERED'"];
      const params: any[] = [];

      if (riderId) {
        params.push(riderId);
        conditions.push(`(da.rider_id = $${params.length} OR da.rider_uuid::text = $${params.length})`);
      }

      const result = await Database.query(`
        SELECT 
          da.id as "deliveryId",
          da.order_id as "orderId",
          da.order_number as "orderNumber",
          da.rider_id as "riderId",
          da.rider_name as "riderName",
          da.status as "deliveryStatus",
          da.delivery_address as "deliveryAddress",
          da.assigned_at as "assignedAt",
          da.delivered_at as "deliveredAt",
          da.delivery_otp as "deliveryOtp",
          o.grand_total as "grandTotal",
          50.00 as "earnings"
        FROM delivery_assignments da
        JOIN orders o ON da.order_id = o.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY da.delivered_at DESC NULLS LAST
        LIMIT 50
      `, params);

      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. First-Acceptance-Wins Atomic Order Assignment (ACID Guaranteed)
  app.post(['/api/v1/fulfillment/deliveries/:orderId/accept', '/api/v1/fulfillment/deliveries/assign'], async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    try {
      const riderId = String(req.headers['x-user-id'] || req.body?.riderId || '');
      const result = await claimDelivery(String(req.params.orderId || req.body?.orderId || ''), riderId);
      broadcastDeliveryEvent({ type: 'ORDER_ASSIGNED', ...result, timestamp: result.assignedAt });
      res.json(okResponse(result, correlationId));
    } catch (error) {
      if (error instanceof DeliveryClaimError) return res.status(error.status).json(errorResponse(error.code, error.message, correlationId));
      next(error);
    }
  });

  // 5. Delivery Partner Updates Delivery Status (Reached Store, Picked Up, Delivered)
  app.post(['/api/v1/fulfillment/deliveries/:orderId/status', '/api/v1/fulfillment/deliveries/:orderId/pickup', '/api/v1/fulfillment/deliveries/:orderId/complete'], async (req: Request, res: Response, next: NextFunction) => {
    const client = await Database.getClient();
    let committed = false;
    const commit = async () => { await client.query('COMMIT'); committed = true; };
    try {
      await client.query('BEGIN');
      const { orderId } = req.params;
      let status = req.body?.status;
      const { otp, proofSignature, proofNotes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // Support legacy pickup and complete routes
      if (req.path.endsWith('/pickup')) status = 'IN_TRANSIT';
      if (req.path.endsWith('/complete')) status = 'DELIVERED';

      const ordRes = await client.query(
        `SELECT id, order_number, delivery_address, grand_total, payment_intent_id, status FROM orders WHERE id::text = $1 OR order_number = $1 FOR UPDATE`,
        [orderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }
      const order = ordRes.rows[0];
      if (order.status === 'CANCELLED') return res.status(409).json(errorResponse('ORDER_CANCELLED', 'Cancelled orders cannot be delivered.', correlationId));

      const daRes = await client.query(
        `SELECT * FROM delivery_assignments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [order.id]
      );
      if (daRes.rows.length === 0) {
        return res.status(404).json(errorResponse('DELIVERY_NOT_FOUND', 'Delivery assignment not found', correlationId));
      }
      const delivery = daRes.rows[0];

      const authHeader = (req.headers['authorization'] || '') as string;
      let tokenRiderId = '';
      if (authHeader.startsWith('Bearer dp_token_')) {
        tokenRiderId = authHeader.replace('Bearer dp_token_', '').split('_')[0];
      }

      const actingRider = String(req.headers['x-user-id'] || req.body?.riderId || tokenRiderId || '');
      const assignedRiderId = String(delivery.rider_id || '');
      const assignedRiderUuid = String(delivery.rider_uuid || '');
      const assignedPhone = String(delivery.rider_phone || '');

      const isAssigned = actingRider && (
        actingRider === assignedRiderId ||
        actingRider === assignedRiderUuid ||
        actingRider === assignedPhone ||
        (delivery.rider_name && actingRider.toLowerCase() === String(delivery.rider_name).toLowerCase())
      );

      if (!actingRider || !isAssigned) {
        return res.status(403).json(errorResponse('DELIVERY_NOT_YOURS', 'Only the assigned delivery partner can update this delivery.', correlationId));
      }
      if (delivery.status === 'DELIVERED') return res.json(okResponse({ orderId: order.id, status: 'DELIVERED' }, correlationId));
      const allowed: Record<string, string[]> = { ASSIGNED: ['REACHED_STORE'], REACHED_STORE: ['PICKED_UP', 'IN_TRANSIT'], IN_TRANSIT: ['DELIVERED'] };
      if (!(allowed[delivery.status] || []).includes(status)) {
        return res.status(409).json(errorResponse('INVALID_DELIVERY_TRANSITION', 'Follow the pickup and delivery steps in order.', correlationId));
      }

      // Step A: Reached Store
      if (status === 'REACHED_STORE') {
        await client.query(`
          UPDATE delivery_assignments 
          SET status = 'REACHED_STORE', reached_store_at = NOW(), updated_at = NOW() 
          WHERE id = $1
        `, [delivery.id]);

        await commit();
        broadcastDeliveryEvent({
          type: 'DELIVERY_STATUS_CHANGED',
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'REACHED_STORE',
          riderId: delivery.rider_id,
          timestamp: new Date().toISOString()
        });

        return res.status(200).json(okResponse({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'REACHED_STORE',
          message: 'Partner reached dark store'
        }, correlationId));
      }

      // Step B: Picked Up / In Transit
      if (status === 'PICKED_UP' || status === 'IN_TRANSIT') {
        let activeOtp = delivery.delivery_otp;
        if (!activeOtp) {
          activeOtp = Math.floor(1000 + Math.random() * 9000).toString();
        }

        await client.query(`
          UPDATE delivery_assignments 
          SET status = 'IN_TRANSIT', delivery_otp = $1, dispatched_at = NOW(), updated_at = NOW() 
          WHERE id = $2
        `, [activeOtp, delivery.id]);

        await client.query(`
          UPDATE orders SET status = 'DISPATCHED', updated_at = NOW() WHERE id = $1
        `, [order.id]);

        // Sync with order-service domain API
        try {
          const ordUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
          fetch(`${ordUrl}/api/v1/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'DISPATCHED' }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        } catch {}

        await commit();

        // Dispatch WhatsApp update to customer with real Verification PIN
        try {
          let addr: any = order.delivery_address;
          if (typeof addr === 'string') {
            try { addr = JSON.parse(addr); } catch { addr = {}; }
          }
          const rawPhone = addr?.phone || addr?.phoneNumber || (order as any)?.customer_phone;
          if (rawPhone) {
            let phoneDigits = String(rawPhone).replace(/[^0-9]/g, '');
            if (phoneDigits.length === 10) {
              phoneDigits = `91${phoneDigits}`;
            }
            const phone = `+${phoneDigits}`;
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `🛵 *Your FreshCart Order is Out for Delivery!*\n\nOrder *${order.order_number}* has been picked up from our Dark Store and is on its way to you!\n⏱️ *Estimated Delivery:* 8–12 minutes.\n\n🔑 *Delivery Verification PIN:* *${activeOtp}*\n(Please share this 4-digit PIN with your delivery partner at your doorstep)\n\nReply *'Track'* anytime for live location updates!`
              })
            }).catch((err) => {
              logger.warn('Failed to dispatch WhatsApp OTP notification', { error: err.message });
            });
          }
        } catch (err: any) {
          logger.warn('Error formatting WhatsApp dispatch', { error: err.message });
        }

        broadcastDeliveryEvent({
          type: 'DELIVERY_STATUS_CHANGED',
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'IN_TRANSIT',
          riderId: delivery.rider_id,
          deliveryOtp: activeOtp,
          timestamp: new Date().toISOString()
        });

        return res.status(200).json(okResponse({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'IN_TRANSIT',
          deliveryOtp: activeOtp,
          dispatchedAt: new Date().toISOString()
        }, correlationId));
      }

      // Step C: Complete Delivery at Doorstep with 4-Digit OTP
      if (status === 'DELIVERED') {
        if (order.payment_intent_id === 'COD' && req.body.cashCollected !== true) return res.status(400).json(errorResponse('CASH_NOT_COLLECTED', 'Confirm that the cash amount was collected before completing delivery.', correlationId));
        const expectedOtp = delivery.delivery_otp;
        if (!expectedOtp || !otp || String(otp).trim() !== String(expectedOtp).trim()) {
          return res.status(400).json(errorResponse(
            'INVALID_DELIVERY_PIN',
            'Invalid 4-digit Delivery PIN. Please ask the customer for their verification PIN.',
            correlationId
          ));
        }

        await client.query(`
          UPDATE delivery_assignments 
          SET status = 'DELIVERED', 
              delivered_at = NOW(), 
              proof_signature = COALESCE($1, proof_signature),
              proof_notes = COALESCE($2, proof_notes),
              updated_at = NOW() 
          WHERE id = $3
        `, [proofSignature || null, proofNotes || 'Handed to customer with verified OTP', delivery.id]);

        await client.query(`
          UPDATE orders SET status = 'DELIVERED', updated_at = NOW() WHERE id = $1
        `, [order.id]);

        // Sync with order-service domain API
        try {
          const ordUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
          fetch(`${ordUrl}/api/v1/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'DELIVERED' }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        } catch {}

        const riderKey = delivery.rider_uuid || delivery.rider_id;
        if (riderKey) {
          await client.query(`
            UPDATE delivery_riders 
            SET status = 'ONLINE',
                total_orders_completed = total_orders_completed + 1,
                earnings_today = earnings_today + 50.00,
                cod_collected_today = COALESCE(cod_collected_today, 0) + $2,
                total_earnings_all_time = total_earnings_all_time + 50.00,
                last_active_at = NOW(),
                updated_at = NOW()
            WHERE id::text = $1 OR phone = $1
          `, [riderKey, order.payment_intent_id === 'COD' ? Number(order.grand_total) : 0]);
        }

        await commit();

        // WhatsApp confirmation
        try {
          const phone = (order.delivery_address as any)?.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `🎉 *Order Delivered Successfully!*\n\nYour order *${order.order_number}* has been verified and delivered to your doorstep. We hope you enjoy your fresh groceries!\n\nThank you for choosing FreshCart. 🛍️`
              })
            }).catch(() => {});
          }
        } catch {}



        broadcastDeliveryEvent({
          type: 'DELIVERY_STATUS_CHANGED',
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'DELIVERED',
          riderId: delivery.rider_id,
          timestamp: new Date().toISOString()
        });

        return res.status(200).json(okResponse({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'DELIVERED',
          deliveredAt: new Date().toISOString()
        }, correlationId));
      }

      return res.status(400).json(errorResponse('INVALID_STATUS', 'Status must be REACHED_STORE, PICKED_UP, IN_TRANSIT, or DELIVERED', correlationId));
    } catch (err) {
      next(err);
    } finally {
      if (!committed) await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });

  // 6. Rider updates live GPS location
  app.post('/api/v1/fulfillment/deliveries/:orderId/location', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { lat, lng, etaMinutes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(`
        UPDATE delivery_assignments 
        SET current_lat = COALESCE($1, current_lat), 
            current_lng = COALESCE($2, current_lng), 
            estimated_arrival_minutes = COALESCE($3, estimated_arrival_minutes),
            updated_at = NOW() 
        WHERE order_id::text = $4 OR order_number = $4
      `, [lat ? Number(lat) : null, lng ? Number(lng) : null, etaMinutes ? parseInt(etaMinutes, 10) : null, orderId]);

      res.status(200).json(okResponse({ orderId, lat, lng, etaMinutes, updatedAt: new Date().toISOString() }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 7. Live Delivery Tracking & GPS coordinates (For Customer Web Map & Tracking)
  app.get('/api/v1/fulfillment/deliveries/:orderId/tracking', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const result = await Database.query(`
        SELECT 
          da.id as "deliveryId",
          da.order_id as "orderId",
          da.order_number as "orderNumber",
          da.rider_name as "riderName",
          da.rider_phone as "riderPhone",
          da.status as "deliveryStatus",
          da.current_lat as "currentLat",
          da.current_lng as "currentLng",
          da.estimated_arrival_minutes as "etaMinutes",
          da.delivery_otp as "deliveryOtp",
          da.proof_signature as "proofSignature",
          da.proof_notes as "proofNotes",
          da.assigned_at as "assignedAt",
          da.dispatched_at as "dispatchedAt",
          da.delivered_at as "deliveredAt",
          o.status as "orderStatus",
          o.delivery_address as "deliveryAddress",
          o.grand_total as "grandTotal"
        FROM orders o
        LEFT JOIN delivery_assignments da ON o.id = da.order_id
        WHERE o.id::text = $1 OR o.order_number = $1
        ORDER BY da.created_at DESC
        LIMIT 1
      `, [orderId]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }

      res.status(200).json(okResponse(result.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Proof of Delivery (POD) Photo & Signature Submission
  app.post('/api/v1/fulfillment/deliveries/:orderId/pod', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { photoUrl, signature, notes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS proof_photo_url TEXT;`).catch(() => {});

      const result = await Database.query(`
        UPDATE delivery_assignments
        SET proof_photo_url = COALESCE($1, proof_photo_url),
            proof_signature = COALESCE($2, proof_signature),
            proof_notes = COALESCE($3, proof_notes),
            updated_at = NOW()
        WHERE order_id::text = $4 OR order_number = $4
        RETURNING id, order_id, order_number, proof_photo_url, proof_signature, proof_notes
      `, [photoUrl || null, signature || null, notes || null, orderId]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse('DELIVERY_NOT_FOUND', 'Active delivery assignment not found for order', correlationId));
      }

      res.status(200).json(okResponse({ success: true, ...result.rows[0] }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Return-to-Origin (RTO) when customer is unreachable or refuses delivery
  app.post('/api/v1/fulfillment/deliveries/:orderId/rto', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { reason, notes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // 1. Mark delivery assignment as RTO_INITIATED
      const daRes = await Database.query(`
        UPDATE delivery_assignments
        SET status = 'RTO_INITIATED',
            proof_notes = COALESCE($1, proof_notes),
            updated_at = NOW()
        WHERE order_id::text = $2 OR order_number = $2
        RETURNING id, order_id, order_number, rider_phone
      `, [notes || reason || 'Customer unreachable at doorstep', orderId]);

      // 2. Update orders table status to RTO
      const ordRes = await Database.query(`
        UPDATE orders
        SET status = 'RTO_INITIATED',
            cancellation_reason = $1,
            updated_at = NOW()
        WHERE id::text = $2 OR order_number = $2
        RETURNING id, order_number, delivery_address, grand_total, customer_id
      `, [`RTO: ${reason || 'Customer unreachable'}`, orderId]);

      const order = ordRes.rows[0];

      // 3. Proactive WhatsApp alert to customer informing of delivery attempt & RTO
      if (order) {
        try {
          const addr = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : (order.delivery_address || {});
          const phone = addr.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `⚠️ *FreshCart Delivery Attempt Failed*\n\n` +
                  `Order: *#${order.order_number}*\n` +
                  `Reason: ${reason || 'Doorstep unreachable / customer contact unavailable'}\n\n` +
                  `Your items are being returned to the local dark store. If you need redelivery or support, please reply to this message directly!`,
              }),
            }).catch(() => {});
          }
        } catch {}
      }

      res.status(200).json(
        okResponse(
          {
            success: true,
            orderId,
            status: 'RTO_INITIATED',
            reason: reason || 'Customer unreachable',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Feature: Delivery & Rider Rating Feedback
  app.post('/api/v1/fulfillment/deliveries/:orderId/feedback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { rating, tags, reviewText } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(`
        CREATE TABLE IF NOT EXISTS delivery_feedback (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          order_id UUID NOT NULL,
          rider_id VARCHAR(64),
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          tags JSONB DEFAULT '[]'::jsonb,
          review_text TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const daRes = await Database.query(`SELECT rider_phone FROM delivery_assignments WHERE order_id::text = $1 OR order_number = $1 LIMIT 1`, [orderId]);

      const insRes = await Database.query(`
        INSERT INTO delivery_feedback (order_id, rider_id, rating, tags, review_text)
        VALUES (
          COALESCE((SELECT id FROM orders WHERE id::text = $1 OR order_number = $1 LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid),
          $2, $3, $4, $5
        )
        RETURNING *
      `, [orderId, daRes.rows[0]?.rider_phone || null, parseInt(rating, 10) || 5, JSON.stringify(tags || []), reviewText || '']);

      res.status(201).json(okResponse({ success: true, feedback: insRes.rows[0] }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Record Rider Tip on Delivery Assignment
  app.post('/api/v1/fulfillment/deliveries/:orderId/tip', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { tipAmount } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      await Database.query(`ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) DEFAULT 0.00;`).catch(() => {});

      await Database.query(`
        UPDATE delivery_assignments
        SET tip_amount = COALESCE(tip_amount, 0) + $1, updated_at = NOW()
        WHERE order_id::text = $2 OR order_number = $2
      `, [parseFloat(tipAmount || 0), orderId]);

      res.status(200).json(okResponse({ success: true, orderId, tipAdded: parseFloat(tipAmount || 0) }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Damaged Stock Warehouse Write-Off
  app.post('/api/v1/fulfillment/tasks/damaged-stock-writeoff', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { sku, quantity, damageReason, notes, binLocation } = req.body || {};

      if (!sku || !quantity) {
        return res.status(400).json(errorResponse('INVALID_PARAM', 'sku and quantity required', correlationId));
      }

      await Database.query(`
        CREATE TABLE IF NOT EXISTS damaged_stock_writeoffs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          sku VARCHAR(64) NOT NULL,
          quantity INTEGER NOT NULL,
          damage_reason VARCHAR(64) NOT NULL,
          bin_location VARCHAR(32),
          notes TEXT,
          written_off_by VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const insRes = await Database.query(`
        INSERT INTO damaged_stock_writeoffs (sku, quantity, damage_reason, bin_location, notes, written_off_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [sku.toUpperCase(), parseInt(quantity, 10), damageReason || 'DAMAGED_IN_BIN', binLocation || 'BIN-A1', notes || '', req.headers['x-user-id'] || 'staff']);

      // Deduct from inventory service
      try {
        const invUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
        await fetch(`${invUrl}/api/v1/inventory/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
          body: JSON.stringify({ sku, delta: -parseInt(quantity, 10), reason: `Damaged write-off: ${damageReason || 'SPOILED'}` }),
        });
      } catch {}

      res.status(201).json(okResponse({ success: true, writeOff: insRes.rows[0] }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Rider Daily Payouts & Earnings Statement
  app.get('/api/v1/fulfillment/riders/:id/payouts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const riderId = req.params.id;
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const dropsRes = await Database.query(`
        SELECT count(*)::int as total_drops,
               COALESCE(SUM(tip_amount), 0) as total_tips
        FROM delivery_assignments
        WHERE (rider_phone = $1 OR rider_name = $1)
          AND status = 'DELIVERED'
          AND delivered_at::date = $2::date
      `, [riderId, date]);

      const totalDrops = dropsRes.rows[0]?.total_drops || 0;
      const totalTips = parseFloat(dropsRes.rows[0]?.total_tips || 0);
      const basePayPerDrop = 40.00;
      const baseEarnings = totalDrops * basePayPerDrop;
      const incentiveBonus = totalDrops >= 15 ? 150.00 : totalDrops >= 10 ? 75.00 : 0.00;
      const totalPayout = baseEarnings + totalTips + incentiveBonus;

      res.status(200).json(
        okResponse(
          {
            riderId,
            date,
            totalDropsCompleted: totalDrops,
            basePay: baseEarnings,
            customerTips: totalTips,
            incentiveBonus,
            totalDailyPayout: totalPayout,
            currency: 'INR',
          },
          correlationId
        )
      );
    } catch (err) {
      next(err);
    }
  });

  // Feature: Cash on Delivery (COD) Handover Reconciliation
  app.post('/api/v1/fulfillment/riders/:id/cod-reconcile', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const riderId = req.params.id;
      const { cashHandedOver, storeManagerId, notes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const amount = parseFloat(cashHandedOver);

      await Database.query(`
        CREATE TABLE IF NOT EXISTS cod_reconciliations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          rider_id VARCHAR(64) NOT NULL,
          store_manager_id VARCHAR(64) NOT NULL,
          amount_reconciled NUMERIC(12, 2) NOT NULL,
          notes TEXT,
          reconciled_at TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch(() => {});

      const insRes = await Database.query(`
        INSERT INTO cod_reconciliations (rider_id, store_manager_id, amount_reconciled, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [riderId, storeManagerId || 'store_mgr', amount || 0, notes || 'Daily shift close cash handover']);

      res.status(200).json(okResponse({ success: true, reconciliation: insRes.rows[0] }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Emergency Rider Reassignment (Breakdown / Accident)
  app.post('/api/v1/fulfillment/deliveries/:orderId/reassign', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { newRiderName, newRiderPhone, reason } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const updRes = await Database.query(`
        UPDATE delivery_assignments
        SET rider_name = COALESCE($1, 'Standby Rider Fleet'),
            rider_phone = COALESCE($2, '+919999888877'),
            proof_notes = CONCAT(proof_notes, ' [Reassigned: ', $3::text, ']'),
            updated_at = NOW()
        WHERE order_id::text = $4 OR order_number = $4
        RETURNING *
      `, [newRiderName || null, newRiderPhone || null, reason || 'Emergency vehicle breakdown', orderId]);

      if (updRes.rows.length === 0) {
        return res.status(404).json(errorResponse('DELIVERY_NOT_FOUND', 'Active delivery not found', correlationId));
      }

      res.status(200).json(okResponse({ success: true, reallocatedAssignment: updRes.rows[0] }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Feature: Geofence Arrival Proximity Trigger
  app.post('/api/v1/fulfillment/deliveries/:orderId/geofence-alert', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const ordRes = await Database.query(
        `SELECT o.order_number, o.delivery_address, da.rider_name, da.delivery_otp
         FROM orders o
         LEFT JOIN delivery_assignments da ON o.id = da.order_id
         WHERE o.id::text = $1 OR o.order_number = $1
         LIMIT 1`,
        [orderId]
      );

      const order = ordRes.rows[0];
      if (order) {
        const addr = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : (order.delivery_address || {});
        const rawPhone = addr.phone || addr.phoneNumber;
        if (rawPhone) {
          let phoneDigits = String(rawPhone).replace(/[^0-9]/g, '');
          if (phoneDigits.length === 10) {
            phoneDigits = `91${phoneDigits}`;
          }
          const phone = `+${phoneDigits}`;
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `🔔 *Rider Arriving at Your Gate!*\n\n` +
                `Our delivery partner *${order.rider_name || 'Rider'}* is 100 meters away from your doorstep!\n` +
                `🔑 *Delivery Verification OTP:* *${order.delivery_otp || '****'}*\n\n` +
                `Please be ready at the door for instant contactless handover.`,
            }),
          }).catch(() => {});
        }
      }

      res.status(200).json(okResponse({ success: true, orderId, alerted: true }, correlationId));
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

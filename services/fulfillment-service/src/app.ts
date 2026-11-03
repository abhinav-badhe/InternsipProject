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

        // Mark authoritative order as PACKED so it appears on Rider Dispatch
        await Database.query(`
          UPDATE orders 
          SET status = 'PACKED', updated_at = NOW() 
          WHERE id = $1 OR order_number = $2
        `, [item.orderId, item.orderNumber]).catch(() => {});

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

      const pickListRes = await Database.query(`
        SELECT 
          pl.id as "pickListId",
          pl.order_id as "orderId",
          pl.order_number as "orderNumber",
          pl.customer_id as "customerId",
          pl.status as "pickListStatus",
          pl.zone,
          o.grand_total as "grandTotal",
          o.status as "orderStatus"
        FROM pick_lists pl
        LEFT JOIN orders o ON pl.order_id = o.id OR pl.order_number = o.order_number
        WHERE pl.order_number = $1
        LIMIT 1
      `, [orderNumber]);

      if (pickListRes.rows.length === 0) {
        return res
          .status(404)
          .json(errorResponse('NOT_FOUND', `No pick list found for order ${orderNumber}`, correlationId));
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
  // FEATURE 6 & 7: RIDER / DELIVERY PARTNER FLEET & LIVE TRACKING API
  // ====================================================================

  // Ensure delivery_assignments table exists gracefully
  Database.query(`
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
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      dispatched_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      proof_signature TEXT,
      proof_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `).catch((err: any) => {
    logger.warn('delivery_assignments init notice', { error: err.message });
  });

  // 1. Available orders ready for rider pickup
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
          COUNT(oi.id) as "itemCount"
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN delivery_assignments da ON o.id = da.order_id AND da.status != 'CANCELLED'
        WHERE o.status IN ('CONFIRMED', 'PACKED', 'PICKING')
          AND da.id IS NULL
        GROUP BY o.id, o.order_number, o.status, o.grand_total, o.delivery_address, o.created_at
        ORDER BY o.created_at ASC
        LIMIT 25
      `);
      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Active deliveries for riders and dispatch overview
  app.get('/api/v1/fulfillment/deliveries/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const riderId = req.query.riderId as string;
      const conditions: string[] = ["da.status IN ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT')"];
      const params: any[] = [];

      if (riderId) {
        params.push(riderId);
        conditions.push(`da.rider_id = $${params.length}`);
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
          da.assigned_at as "assignedAt",
          da.dispatched_at as "dispatchedAt",
          o.grand_total as "grandTotal",
          o.status as "orderStatus"
        FROM delivery_assignments da
        JOIN orders o ON da.order_id = o.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY da.assigned_at DESC
      `, params);
      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Rider accepts delivery task
  app.post(['/api/v1/fulfillment/deliveries/:orderId/accept', '/api/v1/fulfillment/deliveries/assign'], async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId || req.body?.orderId;
      const { riderId, riderName, riderPhone } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const ordRes = await Database.query(
        `SELECT id, order_number, status, delivery_address, grand_total FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }
      const order = ordRes.rows[0];

      const rId = riderId || req.headers['x-user-id'] || 'rider_express_01';
      const rName = riderName || 'Rahul Sharma (Express Rider)';
      const rPhone = riderPhone || '+91 98765 00112';

      const assignId = crypto.randomUUID();
      await Database.query(`
        INSERT INTO delivery_assignments (
          id, order_id, order_number, rider_id, rider_name, rider_phone,
          status, delivery_address, assigned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ASSIGNED', $7, NOW())
        ON CONFLICT DO NOTHING
      `, [assignId, order.id, order.order_number, rId, rName, rPhone, JSON.stringify(order.delivery_address)]);

      res.status(200).json(okResponse({
        deliveryId: assignId,
        orderId: order.id,
        orderNumber: order.order_number,
        riderName: rName,
        status: 'ASSIGNED',
        assignedAt: new Date().toISOString()
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. Rider picks up order from dark store -> Out for Delivery
  app.post('/api/v1/fulfillment/deliveries/:orderId/pickup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const ordRes = await Database.query(
        `SELECT id, order_number, delivery_address FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }
      const order = ordRes.rows[0];

      await Database.query(`
        UPDATE delivery_assignments 
        SET status = 'IN_TRANSIT', dispatched_at = NOW(), updated_at = NOW() 
        WHERE order_id = $1
      `, [order.id]);

      // Update Order Service status to DISPATCHED
      try {
        const ordUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
        await fetch(`${ordUrl}/api/v1/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DISPATCHED' })
        });
      } catch {}

      // Dispatch WhatsApp update to customer
      try {
        const phone = (order.delivery_address as any)?.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `🛵 *Your FreshCart Order is Out for Delivery!*\n\nOrder *${order.order_number}* has been picked up from our Dark Store and is on its way to you!\n⏱️ *Estimated Delivery:* 8–12 minutes.\n\nReply *'Track'* anytime for live location updates!`
            })
          }).catch(() => {});
        }
      } catch {}

      res.status(200).json(okResponse({
        orderId: order.id,
        orderNumber: order.order_number,
        status: 'IN_TRANSIT',
        dispatchedAt: new Date().toISOString()
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 5. Rider updates live GPS location
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

  // 6. Complete delivery at customer doorstep (Proof of Delivery)
  app.post('/api/v1/fulfillment/deliveries/:orderId/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.params;
      const { proofSignature, proofNotes } = req.body || {};
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      const ordRes = await Database.query(
        `SELECT id, order_number, delivery_address FROM orders WHERE id::text = $1 OR order_number = $1`,
        [orderId]
      );
      if (ordRes.rows.length === 0) {
        return res.status(404).json(errorResponse('ORDER_NOT_FOUND', 'Order not found', correlationId));
      }
      const order = ordRes.rows[0];

      await Database.query(`
        UPDATE delivery_assignments 
        SET status = 'DELIVERED', 
            delivered_at = NOW(), 
            proof_signature = COALESCE($1, proof_signature),
            proof_notes = COALESCE($2, proof_notes),
            updated_at = NOW() 
        WHERE order_id = $3
      `, [proofSignature || null, proofNotes || 'Handed to customer at doorstep', order.id]);

      // Update Order Service status to DELIVERED
      try {
        const ordUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
        await fetch(`${ordUrl}/api/v1/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DELIVERED' })
        });
      } catch {}

      // Dispatch WhatsApp confirmation
      try {
        const phone = (order.delivery_address as any)?.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `🎉 *Order Delivered Successfully!*\n\nYour order *${order.order_number}* has been delivered to your doorstep. We hope you enjoy your fresh groceries!\n\nThank you for choosing FreshCart. 🛍️`
            })
          }).catch(() => {});
        }
      } catch {}

      res.status(200).json(okResponse({
        orderId: order.id,
        orderNumber: order.order_number,
        status: 'DELIVERED',
        deliveredAt: new Date().toISOString()
      }, correlationId));
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

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled fulfillment service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

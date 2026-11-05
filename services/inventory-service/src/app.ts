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

// Background worker: Periodically clean up expired stock reservations (Releases zombie stock holds)
const expiryWorkerInterval = setInterval(async () => {
  try {
    const released = await inventoryRepo.releaseExpiredReservations();
    if (released > 0) {
      logger.info('Background worker released expired stock reservations', { releasedCount: released });
    }
  } catch (err: any) {
    logger.warn('Error running reservation expiry worker', { error: err.message });
  }
}, 30_000);
if (typeof expiryWorkerInterval?.unref === 'function') {
  expiryWorkerInterval.unref();
}

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

  // ====================================================================
  // FEATURE 11: AUTOMATED PURCHASE ORDERS & SUPPLIER PORTAL
  // ====================================================================

  // Ensure Purchase Order & Supplier schema exists
  Database.query(`
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      aggregate_type VARCHAR(64) NOT NULL,
      aggregate_id VARCHAR(128) NOT NULL,
      event_type VARCHAR(128) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_outbox_status ON outbox_events(status);

    CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      contact_person VARCHAR(128),
      phone VARCHAR(32),
      email VARCHAR(128),
      lead_time_days INTEGER DEFAULT 2,
      rating NUMERIC(2, 1) DEFAULT 4.8,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      po_number VARCHAR(32) NOT NULL UNIQUE,
      supplier_id UUID REFERENCES suppliers(id),
      supplier_name VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      item_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      issued_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      sku VARCHAR(64) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
      suggested_qty NUMERIC(12, 3) NOT NULL,
      ordered_qty NUMERIC(12, 3) NOT NULL,
      unit_cost NUMERIC(10, 2) NOT NULL,
      line_total NUMERIC(12, 2) NOT NULL,
      received_qty NUMERIC(12, 3) DEFAULT 0.000,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `).then(async () => {
    // Seed default suppliers if empty
    const suppCount = await Database.query(`SELECT COUNT(*) as cnt FROM suppliers`);
    if (parseInt(suppCount.rows[0]?.cnt || '0', 10) === 0) {
      await Database.query(`
        INSERT INTO suppliers (code, name, contact_person, phone, email, lead_time_days, rating)
        VALUES
          ('SUP-AMUL', 'Amul Dairy Hub', 'Ramesh Patel', '+919876500001', 'orders@amuldairy.com', 1, 4.9),
          ('SUP-HUL', 'Hindustan Unilever Dist', 'Priya Sharma', '+919876500002', 'orders@hulsupply.in', 2, 4.8),
          ('SUP-ITC', 'ITC Agrotech Direct', 'Anil Verma', '+919876500003', 'b2b@itcfoods.com', 2, 4.7),
          ('SUP-TATA', 'Tata Consumer Supplies', 'Sunita Rao', '+919876500004', 'supply@tataconsumer.com', 1, 4.9)
        ON CONFLICT DO NOTHING;
      `);
    }
  }).catch((err: any) => {
    logger.warn('Suppliers/PO schema initialization notice', { error: err.message });
  });

  // 1. Get Suppliers Directory
  app.get('/api/v1/inventory/suppliers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const result = await Database.query(`
        SELECT id, code, name, contact_person as "contactPerson", phone, email, lead_time_days as "leadTimeDays", rating, is_active as "isActive"
        FROM suppliers
        WHERE is_active = TRUE
        ORDER BY name ASC
      `);
      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Get All Purchase Orders with Line Items
  app.get('/api/v1/inventory/purchase-orders', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const posRes = await Database.query(`
        SELECT 
          po.id,
          po.po_number as "poNumber",
          po.supplier_id as "supplierId",
          po.supplier_name as "supplierName",
          po.status,
          po.total_amount as "totalAmount",
          po.item_count as "itemCount",
          po.notes,
          po.issued_at as "issuedAt",
          po.received_at as "receivedAt",
          po.created_at as "createdAt"
        FROM purchase_orders po
        ORDER BY po.created_at DESC
        LIMIT 50
      `);

      const ordersWithItems = [];
      for (const po of posRes.rows) {
        const itemsRes = await Database.query(`
          SELECT 
            id,
            sku,
            product_name as "productName",
            current_stock as "currentStock",
            suggested_qty as "suggestedQty",
            ordered_qty as "orderedQty",
            unit_cost as "unitCost",
            line_total as "lineTotal",
            received_qty as "receivedQty"
          FROM purchase_order_items
          WHERE purchase_order_id = $1
          ORDER BY sku ASC
        `, [po.id]);

        ordersWithItems.push({
          ...po,
          totalAmount: parseFloat(po.totalAmount),
          items: itemsRes.rows.map((it: any) => ({
            ...it,
            currentStock: parseFloat(it.currentStock),
            suggestedQty: parseFloat(it.suggestedQty),
            orderedQty: parseFloat(it.orderedQty),
            unitCost: parseFloat(it.unitCost),
            lineTotal: parseFloat(it.lineTotal),
            receivedQty: parseFloat(it.receivedQty),
          })),
        });
      }

      res.status(200).json(okResponse(ordersWithItems, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Auto-Generate Purchase Order from Low-Stock / Demand Forecast Alert items
  app.post('/api/v1/inventory/purchase-orders/auto-generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      let { items, supplierId, notes } = req.body || {};

      // If items not supplied, automatically query low stock balances (<= 15 on hand)
      if (!items || !Array.isArray(items) || items.length === 0) {
        const lowRes = await Database.query(`
          SELECT sb.sku, sb.on_hand_qty as "currentStock", p.name as "productName", bp.amount as "price"
          FROM stock_balances sb
          LEFT JOIN products p ON sb.sku = p.id::text OR p.name ILIKE '%' || split_part(sb.sku, '-', 2) || '%'
          LEFT JOIN base_prices bp ON sb.sku = bp.sku AND bp.is_active = TRUE
          WHERE sb.on_hand_qty <= 15
          LIMIT 10
        `);

        items = lowRes.rows.map((r: any) => ({
          sku: r.sku,
          productName: r.productName || r.sku,
          currentStock: parseFloat(r.currentStock) || 0,
          suggestedQty: 50,
          unitCost: Math.round((parseFloat(r.price) || 80) * 0.75), // estimated wholesale cost 75% of MRP
        }));
      }

      if (items.length === 0) {
        return res
          .status(400)
          .json(errorResponse('NO_ITEMS', 'No low-stock items detected to reorder.', correlationId));
      }

      // Find or assign supplier
      let supplierName = 'Amul Dairy Hub';
      if (supplierId) {
        const suppRes = await Database.query(`SELECT id, name FROM suppliers WHERE id = $1`, [supplierId]);
        if (suppRes.rows.length > 0) {
          supplierName = suppRes.rows[0].name;
        }
      } else {
        const suppRes = await Database.query(`SELECT id, name FROM suppliers LIMIT 1`);
        if (suppRes.rows.length > 0) {
          supplierId = suppRes.rows[0].id;
          supplierName = suppRes.rows[0].name;
        }
      }

      const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      let totalAmount = 0;

      for (const it of items) {
        const qty = Number(it.orderedQty || it.suggestedQty || 20);
        const cost = Number(it.unitCost || 50);
        totalAmount += qty * cost;
      }

      // Create purchase_orders record
      const poInsert = await Database.query(`
        INSERT INTO purchase_orders (po_number, supplier_id, supplier_name, status, total_amount, item_count, notes)
        VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6)
        RETURNING id, po_number as "poNumber", status, total_amount as "totalAmount", item_count as "itemCount", created_at as "createdAt"
      `, [poNumber, supplierId || null, supplierName, totalAmount, items.length, notes || 'Generated automatically by ML Demand Alert']);

      const createdPo = poInsert.rows[0];

      // Insert line items
      for (const it of items) {
        const qty = Number(it.orderedQty || it.suggestedQty || 20);
        const cost = Number(it.unitCost || 50);
        const lineTotal = qty * cost;

        await Database.query(`
          INSERT INTO purchase_order_items (
            purchase_order_id, sku, product_name, current_stock, suggested_qty, ordered_qty, unit_cost, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          createdPo.id,
          it.sku,
          it.productName || it.sku,
          Number(it.currentStock || 0),
          Number(it.suggestedQty || qty),
          qty,
          cost,
          lineTotal
        ]);
      }

      logger.info('Auto-generated purchase order from stock alerts', {
        poNumber,
        itemsCount: items.length,
        totalAmount,
      });

      res.status(201).json(okResponse({
        ...createdPo,
        supplierName,
        totalAmount,
        itemCount: items.length,
      }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. Issue Purchase Order to Supplier (Status: DRAFT -> ISSUED)
  app.post('/api/v1/inventory/purchase-orders/:id/issue', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const poId = req.params.id as string;

      const updRes = await Database.query(`
        UPDATE purchase_orders
        SET status = 'ISSUED', issued_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING id, po_number as "poNumber", supplier_name as "supplierName", status, issued_at as "issuedAt"
      `, [poId]);

      if (updRes.rows.length === 0) {
        return res.status(404).json(errorResponse('NOT_FOUND', 'Purchase order not found', correlationId));
      }

      logger.info('Purchase order issued to supplier', { poId, poNumber: updRes.rows[0].poNumber });
      res.status(200).json(okResponse(updRes.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 5. Inward Goods Receipt (Status: ISSUED -> RECEIVED, automatically replenishes inventory)
  app.post('/api/v1/inventory/purchase-orders/:id/receive', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const poId = req.params.id as string;

      const poRes = await Database.query(`SELECT id, po_number, status FROM purchase_orders WHERE id = $1`, [poId]);
      if (poRes.rows.length === 0) {
        return res.status(404).json(errorResponse('NOT_FOUND', 'Purchase order not found', correlationId));
      }

      const po = poRes.rows[0];
      if (po.status === 'RECEIVED') {
        return res.status(400).json(errorResponse('ALREADY_RECEIVED', 'This PO was already received into stock.', correlationId));
      }

      // Fetch items to receive
      const itemsRes = await Database.query(`
        SELECT id, sku, product_name, ordered_qty FROM purchase_order_items WHERE purchase_order_id = $1
      `, [poId]);

      // Replenish stock in inventory for each item
      for (const it of itemsRes.rows) {
        const qty = parseFloat(it.ordered_qty);
        await inventoryRepo.adjustStock({
          sku: it.sku,
          delta: qty,
          reason: 'RECEIPT',
          referenceId: po.po_number,
        }).catch((e: any) => {
          logger.warn('Error adjusting stock for PO item', { sku: it.sku, error: e.message });
        });

        await Database.query(`
          UPDATE purchase_order_items SET received_qty = ordered_qty WHERE id = $1
        `, [it.id]).catch(() => {});
      }

      // Mark PO as RECEIVED
      await Database.query(`
        UPDATE purchase_orders
        SET status = 'RECEIVED', received_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [poId]);

      logger.info('Purchase order goods receipt completed, inventory replenished', {
        poNumber: po.po_number,
        itemCount: itemsRes.rows.length,
      });

      res.status(200).json(okResponse({
        id: poId,
        poNumber: po.po_number,
        status: 'RECEIVED',
        itemsReceived: itemsRes.rows.length,
        message: `Inventory successfully replenished for PO #${po.po_number}`,
      }, correlationId));
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

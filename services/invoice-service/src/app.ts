import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { InvoiceService } from './invoice.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('invoice-service:api');
const invoiceService = new InvoiceService();

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
        serviceName: 'invoice-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming invoice request', { method: req.method, path: req.path });
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

  // List Invoices for Store Admin and Tax Audit
  app.get('/api/v1/invoices', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      // 1. If invoices table has few records, backfill from orders table
      const countRes = await Database.query(`SELECT COUNT(*) as count FROM invoices`);
      const existingCount = parseInt(countRes.rows[0]?.count || '0', 10);

      if (existingCount < 5) {
        const ordersRes = await Database.query(
          `SELECT o.id, o.order_number, o.customer_id, o.subtotal, o.tax_total, o.delivery_fee, o.grand_total, o.delivery_address, o.created_at
           FROM orders o
           ORDER BY o.created_at DESC LIMIT 20`
        );

        for (const ord of ordersRes.rows) {
          const invId = crypto.randomUUID();
          const invoiceNum = `INV-${new Date().getUTCFullYear()}-${ord.order_number.slice(-6)}`;
          const custName = ord.delivery_address?.recipientName || (ord.customer_id.startsWith('phone_') ? `WhatsApp (${ord.customer_id.replace('phone_', '+')})` : 'Verified Customer');
          const halfTax = Number((parseFloat(ord.tax_total || '0') / 2).toFixed(4));

          await Database.query(
            `INSERT INTO invoices (
              id, invoice_number, order_id, order_number, customer_id, customer_name,
              currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
            ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, 0, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING`,
            [
              invId,
              invoiceNum,
              ord.id,
              ord.order_number,
              ord.customer_id,
              custName,
              parseFloat(ord.subtotal || ord.grand_total),
              halfTax,
              halfTax,
              parseFloat(ord.delivery_fee || '0'),
              parseFloat(ord.grand_total),
              `private/invoices/${invoiceNum}.pdf`,
            ]
          );
        }
      }

      // 2. Query invoices with customer phone from orders
      const invoicesRes = await Database.query(`
        SELECT 
          i.id as "invoiceId",
          i.invoice_number as "invoiceNumber",
          i.order_id as "orderId",
          i.order_number as "orderNumber",
          i.customer_id as "customerId",
          i.customer_name as "customerName",
          COALESCE(o.delivery_address->>'phone', '') as "customerPhone",
          i.subtotal as "taxableAmount",
          (i.cgst_total + i.sgst_total) as "totalTax",
          i.delivery_fee as "deliveryFee",
          i.grand_total as "grandTotal",
          i.created_at as "createdAt"
        FROM invoices i
        LEFT JOIN orders o ON i.order_id = o.id
        ORDER BY i.created_at DESC
        LIMIT 100
      `);

      res.status(200).json(okResponse(invoicesRes.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Generate Invoice (Called when order is confirmed / paid)
  app.post('/api/v1/invoices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId, orderNumber, customerId, customerName, customerGstin, currency, subtotal, discountTotal, deliveryFee, items } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!orderId || !orderNumber || !customerId || !customerName || !items || !Array.isArray(items)) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'orderId, orderNumber, customerId, customerName, and items are required', correlationId));
      }

      const result = await invoiceService.generateInvoice({
        orderId,
        orderNumber,
        customerId,
        customerName,
        customerGstin,
        currency,
        subtotal: Number(subtotal || 0),
        discountTotal: Number(discountTotal || 0),
        deliveryFee: Number(deliveryFee || 0),
        items,
      });

      res.status(201).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Request Signed Download URL (Scenario 14: Protected by User Ownership / Staff Role)
  app.get('/api/v1/invoices/:invoiceId/signed-url', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoiceId = req.params.invoiceId as string;
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const requestingUserId = req.headers['x-user-id'] as string;
      const requestingUserRole = (req.headers['x-user-role'] as string) || 'CUSTOMER';

      if (!requestingUserId) {
        return res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', 'Authentication credentials required to request invoice URL', correlationId));
      }

      const signedUrlInfo = await invoiceService.generateSignedDownloadUrl({
        invoiceId,
        requestingUserId,
        requestingUserRole,
      });

      res.status(200).json(okResponse(signedUrlInfo, correlationId));
    } catch (err: any) {
      if (err.message?.includes('FORBIDDEN')) {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res.status(403).json(errorResponse('FORBIDDEN', err.message, correlationId));
      }
      next(err);
    }
  });

  // Acceptance Scenario 14: Download Invoice PDF (Requires valid signed token)
  app.get('/api/v1/invoices/:invoiceId/download', (req: Request, res: Response) => {
    const invoiceId = req.params.invoiceId as string;
    const token = req.query.token as string;
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    if (!token) {
      return res
        .status(401)
        .json(errorResponse('MISSING_TOKEN', 'Direct access denied: A signed expiring token is required to access private invoices', correlationId));
    }

    const verified = invoiceService.verifySignedToken(token);
    if (!verified || verified.invoiceId !== invoiceId) {
      return res
        .status(401)
        .json(errorResponse('INVALID_OR_EXPIRED_TOKEN', 'The provided download link is invalid, tampered, or expired', correlationId));
    }

    // In production, returns stream from Supabase Private Bucket:
    // supabase.storage.from('invoices').download(verified.storageKey)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceId}.pdf"`);
    res.status(200).send(Buffer.from(`%PDF-1.4 Mock Invoice for ${verified.invoiceId} StorageKey: ${verified.storageKey}`));
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled invoice service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

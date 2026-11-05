import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';

const logger = createLogger('invoice-service:engine');

export interface CreateInvoiceParams {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerGstin?: string;
  currency?: string;
  subtotal: number;
  discountTotal?: number;
  deliveryFee?: number;
  items: Array<{
    sku: string;
    description: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
    gstRatePercent: number; // e.g. 5.0, 18.0
    discountAmount?: number;
  }>;
}

export class InvoiceService {
  private readonly signingSecret: string;

  constructor(signingSecret?: string) {
    this.signingSecret =
      signingSecret || process.env.INVOICE_SIGNING_SECRET || 'dev_invoice_signing_secret_999';
  }

  /**
   * Generates a tax-compliant invoice with sequential numbering and line snapshots
   */
  public async generateInvoice(params: CreateInvoiceParams) {
    const year = new Date().getUTCFullYear();

    // 1. Fetch next sequential number
    const seqRes = await Database.query(`SELECT nextval('invoice_number_seq') as seq`);
    const seqNumber = seqRes.rows[0]?.seq || 10001;
    const invoiceNumber = `INV-${year}-${seqNumber}`;

    const invoiceId = crypto.randomUUID();
    const currency = params.currency || 'INR';
    const discountTotal = params.discountTotal || 0.0;
    const deliveryFee = params.deliveryFee || 0.0;

    let subtotalCalc = 0;
    let totalTaxCalc = 0;

    const computedLines = params.items.map((item) => {
      const lineDiscount = item.discountAmount || 0;
      const taxable = item.quantity * item.unitPrice - lineDiscount;
      const taxRate = item.gstRatePercent / 100;
      const taxAmount = taxable * taxRate;
      const cgst = taxAmount / 2;
      const sgst = taxAmount / 2;
      const lineTotal = taxable + taxAmount;

      subtotalCalc += taxable;
      totalTaxCalc += taxAmount;

      return {
        id: crypto.randomUUID(),
        sku: item.sku,
        description: item.description,
        hsnCode: item.hsnCode || '3401',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: lineDiscount,
        taxableAmount: Number(taxable.toFixed(4)),
        gstRatePercent: item.gstRatePercent,
        cgstAmount: Number(cgst.toFixed(4)),
        sgstAmount: Number(sgst.toFixed(4)),
        lineTotal: Number(lineTotal.toFixed(4)),
      };
    });

    const cgstTotal = Number((totalTaxCalc / 2).toFixed(4));
    const sgstTotal = Number((totalTaxCalc / 2).toFixed(4));
    const grandTotal = Number((subtotalCalc + totalTaxCalc + deliveryFee).toFixed(4));
    const storageKey = `private/invoices/${year}/${invoiceNumber}.pdf`;

    // 2. Insert Invoice Record
    await Database.query(
      `INSERT INTO invoices (
        id, invoice_number, order_id, order_number, customer_id, customer_name, customer_gstin,
        currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        invoiceId,
        invoiceNumber,
        params.orderId,
        params.orderNumber,
        params.customerId,
        params.customerName,
        params.customerGstin || null,
        currency,
        subtotalCalc,
        discountTotal,
        cgstTotal,
        sgstTotal,
        deliveryFee,
        grandTotal,
        storageKey,
      ]
    );

    // 3. Insert Line Items
    for (const line of computedLines) {
      await Database.query(
        `INSERT INTO invoice_lines (
          id, invoice_id, sku, description, hsn_code, quantity, unit_price,
          discount_amount, taxable_amount, gst_rate_percent, cgst_amount, sgst_amount, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          line.id,
          invoiceId,
          line.sku,
          line.description,
          line.hsnCode,
          line.quantity,
          line.unitPrice,
          line.discountAmount,
          line.taxableAmount,
          line.gstRatePercent,
          line.cgstAmount,
          line.sgstAmount,
          line.lineTotal,
        ]
      );
    }

    logger.info('Tax-compliant sequential invoice generated', {
      invoiceId,
      invoiceNumber,
      orderNumber: params.orderNumber,
      grandTotal,
    });

    return {
      id: invoiceId,
      invoiceNumber,
      orderNumber: params.orderNumber,
      grandTotal,
      pdfStorageKey: storageKey,
      lines: computedLines,
    };
  }

  /**
   * Generates a short-lived (e.g. 15-minute) signed download URL token for authorized users
   */
  public async generateSignedDownloadUrl(params: {
    invoiceId: string;
    requestingUserId: string;
    requestingUserRole: string;
    ttlSeconds?: number;
  }): Promise<{ signedUrl: string; expiresAt: string }> {
    const ttl = params.ttlSeconds || 900; // default 15 minutes
    const expiresAtMs = Date.now() + ttl * 1000;

    // Fetch invoice to verify authorization
    let invoiceRes = await Database.query(
      `SELECT id, invoice_number, order_id, order_number, customer_id, customer_name,
              currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
       FROM invoices
       WHERE id::text = $1 OR order_id::text = $1 OR invoice_number = $1
       LIMIT 1`,
      [params.invoiceId]
    );

    if (invoiceRes.rows.length === 0) {
      // Auto-generate invoice from orders table on-demand if order exists
      const ordRes = await Database.query(
        `SELECT id, order_number, customer_id, delivery_address, subtotal, tax_total, delivery_fee, grand_total, created_at
         FROM orders
         WHERE id::text = $1 OR order_number = $1
         LIMIT 1`,
        [params.invoiceId]
      );

      if (ordRes.rows.length > 0) {
        const ord = ordRes.rows[0];
        const invId = crypto.randomUUID();
        const shortNum = (ord.order_number || '').replace(/^ORD-|^SUB-/, '') || Date.now().toString().slice(-6);
        const invoiceNum = `INV-2026-${shortNum}`;
        const addr = typeof ord.delivery_address === 'string' ? JSON.parse(ord.delivery_address) : (ord.delivery_address || {});
        const custName = addr.recipientName || 'Valued Customer';
        const halfTax = Number((parseFloat(ord.tax_total || '0') / 2).toFixed(4));
        const subtotal = parseFloat(ord.subtotal || ord.grand_total);
        const grandTotal = parseFloat(ord.grand_total || '0');
        const deliveryFee = parseFloat(ord.delivery_fee || '0');
        const storageKey = `private/invoices/2026/${invoiceNum}.pdf`;

        await Database.query(
          `INSERT INTO invoices (
             id, invoice_number, order_id, order_number, customer_id, customer_name,
             currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
           ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, 0, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [invId, invoiceNum, ord.id, ord.order_number, ord.customer_id, custName, subtotal, halfTax, halfTax, deliveryFee, grandTotal, storageKey]
        );

        invoiceRes = await Database.query(
          `SELECT id, invoice_number, order_id, order_number, customer_id, customer_name,
                  currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
           FROM invoices
           WHERE id = $1 LIMIT 1`,
          [invId]
        );
      }
    }

    if (invoiceRes.rows.length === 0) {
      throw new Error(`Invoice ${params.invoiceId} not found`);
    }

    const invoice = invoiceRes.rows[0];

    // Authorization check: User must own the invoice, share phone match, or be a STORE_ADMIN
    const rawReqUser = (params.requestingUserId || '').replace(/[^0-9]/g, '');
    const rawOwner = (invoice.customer_id || '').replace(/[^0-9]/g, '');
    const isOwnerMatch =
      invoice.customer_id === params.requestingUserId ||
      (rawReqUser.length >= 7 && rawOwner.length >= 7 && (rawOwner.includes(rawReqUser) || rawReqUser.includes(rawOwner))) ||
      params.requestingUserRole === 'STORE_ADMIN';

    if (!isOwnerMatch) {
      logger.warn('Unauthorized invoice signed URL access attempt blocked', {
        invoiceId: params.invoiceId,
        requestingUserId: params.requestingUserId,
        ownerId: invoice.customer_id,
      });
      throw new Error('FORBIDDEN: You are not authorized to access this invoice');
    }

    // Sign payload
    const payload = JSON.stringify({
      invoiceId: invoice.id,
      storageKey: invoice.pdf_storage_key,
      exp: Math.floor(expiresAtMs / 1000),
    });

    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    const token = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

    // Audit log
    await Database.query(
      `INSERT INTO invoice_access_log (id, invoice_id, accessed_by_user_id, user_role, access_type)
       VALUES ($1, $2, $3, $4, 'GENERATE_SIGNED_URL')`,
      [crypto.randomUUID(), invoice.id, params.requestingUserId, params.requestingUserRole]
    );

    const signedUrl = `/api/v1/invoices/${invoice.id}/download?token=${token}`;
    return {
      signedUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  /**
   * Acceptance Scenario 14: Verifies signed download token.
   * Rejects missing, tampered, or expired tokens.
   */
  public verifySignedToken(token: string): { invoiceId: string; storageKey: string } | null {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      if (!decoded.payload || !decoded.signature) return null;

      const expectedSignature = crypto
        .createHmac('sha256', this.signingSecret)
        .update(decoded.payload)
        .digest('hex');

      if (decoded.signature !== expectedSignature) {
        logger.warn('Invoice download token signature mismatch - forgery detected');
        return null;
      }

      const payload = JSON.parse(decoded.payload);
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp < now) {
        logger.warn('Invoice download token expired', { invoiceId: payload.invoiceId });
        return null;
      }

      return {
        invoiceId: payload.invoiceId,
        storageKey: payload.storageKey,
      };
    } catch {
      return null;
    }
  }
}

import { Database } from './db.js';
import {
  CreateOrderRequest,
  OrderResponse,
  QuoteResponse,
  ReserveStockResponse,
} from '@grocery/contracts';
import { createLogger } from '@grocery/observability';
import crypto from 'node:crypto';

const logger = createLogger('order-service:saga');

export interface PricingClient {
  calculateQuote(items: Array<{ sku: string; quantity: number }>, promoCode?: string): Promise<QuoteResponse>;
}

export interface InventoryClient {
  reserveStock(reservationId: string, items: Array<{ sku: string; quantity: number }>): Promise<ReserveStockResponse>;
  releaseReservation(reservationId: string, reason: string): Promise<boolean>;
}

export class CheckoutSagaOrchestrator {
  constructor(
    private readonly pricingClient: PricingClient,
    private readonly inventoryClient: InventoryClient
  ) {}

  /**
   * Orchestrates the checkout saga while enforcing idempotency (Acceptance Scenario 2)
   */
  public async executeCheckout(req: CreateOrderRequest): Promise<OrderResponse> {
    const correlationId = crypto.randomUUID();
    logger.info('Starting checkout saga', { idempotencyKey: req.idempotencyKey, channel: req.channel });

    // 1. IDEMPOTENCY CHECK (Rule: Return existing result for repeated idempotency key)
    const existingOrder = await this.findOrderByIdempotencyKey(req.idempotencyKey);
    if (existingOrder) {
      logger.info('Idempotency hit: Returning existing order without duplicate reservation', {
        orderId: existingOrder.orderId,
        idempotencyKey: req.idempotencyKey,
      });
      return existingOrder;
    }

    // 2. RE-CALCULATE SERVER-SIDE PRICING & TAXES (Cart total is indicative; server recalculates truth)
    const quote = await this.pricingClient.calculateQuote(req.items, req.promoCode);

    // 3. CONCURRENCY-SAFE INVENTORY RESERVATION
    const reservationId = req.reservationId || crypto.randomUUID();
    const reserveOutcome = await this.inventoryClient.reserveStock(reservationId, req.items);

    if (reserveOutcome.status === 'INSUFFICIENT_STOCK') {
      logger.warn('Checkout saga aborted: Insufficient stock', {
        reservationId,
        unavailableItems: reserveOutcome.unavailableItems,
      });
      throw new Error(`INSUFFICIENT_STOCK: ${JSON.stringify(reserveOutcome.unavailableItems)}`);
    }

    // 4. PERSIST ORDER AND SAGA STATE (Database Transaction)
    const client = await Database.getClient();
    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const paymentCheckoutUrl = `https://pay.groceryplatform.com/checkout/sess_${crypto.randomBytes(8).toString('hex')}`;

    try {
      await client.query('BEGIN');

      // Record order master
      await client.query(
        `INSERT INTO orders 
         (id, order_number, idempotency_key, customer_id, channel, status, currency, 
          subtotal, discount_total, tax_total, delivery_fee, grand_total, 
          reservation_id, delivery_address)
         VALUES ($1, $2, $3, $4, $5, 'AWAITING_PAYMENT', $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          orderId,
          orderNumber,
          req.idempotencyKey,
          req.customerId,
          req.channel,
          quote.currency,
          quote.subtotal,
          quote.discountTotal,
          quote.taxTotal,
          quote.deliveryFee,
          quote.grandTotal,
          reservationId,
          JSON.stringify(req.deliveryAddress),
        ]
      );

      // Record immutable line item snapshots
      for (const item of quote.items) {
        await client.query(
          `INSERT INTO order_items 
           (order_id, sku, product_name, variant_name, quantity, unit_price, net_amount, tax_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            orderId,
            item.sku,
            item.productName,
            item.variantName,
            item.quantity,
            item.unitPrice,
            item.netAmount,
            item.taxAmount,
          ]
        );
      }

      // Automatically create Pick List and Pick Items for warehouse fulfillment & packaging
      try {
        const pickListId = crypto.randomUUID();
        await client.query(
          `INSERT INTO pick_lists (id, order_id, order_number, customer_id, zone, status)
           VALUES ($1, $2, $3, $4, 'Zone A-01-R1', 'GENERATED')
           ON CONFLICT DO NOTHING`,
          [pickListId, orderId, orderNumber, req.customerId]
        );

        for (const item of quote.items) {
          const itemId = crypto.randomUUID();
          await client.query(
            `INSERT INTO pick_items (id, pick_list_id, sku, product_name, quantity_requested, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')
             ON CONFLICT DO NOTHING`,
            [itemId, pickListId, item.sku, item.productName, Math.round(Number(item.quantity) || 1)]
          );
        }
      } catch (plErr: any) {
        logger.warn('Fulfillment pick list auto-creation skipped', { error: plErr.message });
      }

      // Automatically generate Tax Invoice for accounting & billing
      try {
        const invoiceId = crypto.randomUUID();
        const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${orderNumber.slice(-6)}`;
        const customerName = (req.deliveryAddress as any)?.recipientName || 'Verified Customer';
        const halfTax = Number((quote.taxTotal / 2).toFixed(4));

        await client.query(
          `INSERT INTO invoices (
            id, invoice_number, order_id, order_number, customer_id, customer_name,
            currency, subtotal, discount_total, cgst_total, sgst_total, delivery_fee, grand_total, pdf_storage_key
          ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT DO NOTHING`,
          [
            invoiceId,
            invoiceNumber,
            orderId,
            orderNumber,
            req.customerId,
            customerName,
            quote.subtotal,
            quote.discountTotal || 0,
            halfTax,
            halfTax,
            quote.deliveryFee || 0,
            quote.grandTotal,
            `private/invoices/${invoiceNumber}.pdf`,
          ]
        );
      } catch (invErr: any) {
        logger.warn('Tax invoice auto-generation skipped', { error: invErr.message });
      }

      // Log saga step
      await client.query(
        `INSERT INTO order_saga_log (order_id, step, status, details)
         VALUES ($1, 'ORDER_CREATED', 'COMPLETED', $2)`,
        [orderId, JSON.stringify({ reservationId, grandTotal: quote.grandTotal })]
      );

      // Transactional Outbox Pattern: Persist domain event within the same ACID transaction
      await client.query(
        `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
         VALUES ('Order', $1, 'order.created', $2)`,
        [
          orderId,
          JSON.stringify({
            orderId,
            orderNumber,
            customerId: req.customerId,
            grandTotal: quote.grandTotal,
            reservationId,
            channel: req.channel,
            items: quote.items.map((i) => ({ sku: i.sku, quantity: i.quantity, price: i.unitPrice })),
            deliveryAddress: req.deliveryAddress,
          }),
        ]
      );

      await client.query('COMMIT');
      logger.info('Checkout saga completed successfully', { orderId, orderNumber });

      // Multi-channel notification: Dispatch WhatsApp payment options & total to customer
      try {
        const phone =
          (req.deliveryAddress as any)?.phone ||
          (req.customerId?.startsWith('phone_') ? req.customerId.replace('phone_', '') : null) ||
          (req.customerId?.startsWith('+') ? req.customerId : null);

        if (phone) {
          const cleanPhone = String(phone).startsWith('+') ? String(phone) : `+${String(phone).replace(/[^0-9]/g, '')}`;
          const upiLink = `upi://pay?pa=freshcart@icici&pn=FreshCart&am=${quote.grandTotal.toFixed(2)}&tn=Order-${orderNumber}&cu=INR`;
          const webPayUrl = `http://localhost:5173/?payOrder=${orderNumber}&amt=${quote.grandTotal.toFixed(2)}`;

          let waPaymentText = `🛍️ *FreshCart Order Placed — Payment Options*\n\n`;
          waPaymentText += `Hello ${(req.deliveryAddress as any)?.recipientName || 'Valued Customer'},\n`;
          waPaymentText += `Your order *${orderNumber}* has been placed and stock is reserved!\n\n`;
          waPaymentText += `🆔 *Order Number:* *${orderNumber}*\n`;
          waPaymentText += `📦 *Items:* ${quote.items.map(i => `${i.productName} × ${i.quantity}`).slice(0, 3).join(', ')}${quote.items.length > 3 ? ` (+${quote.items.length - 3} more)` : ''}\n`;
          waPaymentText += `💰 *Grand Total Payable:* *₹${quote.grandTotal.toFixed(2)}*\n\n`;
          waPaymentText += `━━━━━━━━━━━━━━━━━━━━━\n`;
          waPaymentText += `💳 *CHOOSE YOUR PAYMENT OPTION:*\n\n`;
          waPaymentText += `1️⃣ *Instant UPI Payment (GPay / PhonePe / Paytm / BHIM):*\n${upiLink}\n\n`;
          waPaymentText += `2️⃣ *Web Card / NetBanking Checkout:*\n${webPayUrl}\n\n`;
          waPaymentText += `3️⃣ *Or Simply Reply in WhatsApp:*\n`;
          waPaymentText += `• Reply *'PAY'* for UPI Payment details\n`;
          waPaymentText += `• Reply *'COD'* to choose Cash on Delivery\n`;
          waPaymentText += `• Reply *'PAID'* after completing payment\n`;
          waPaymentText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
          waPaymentText += `🛵 Stock is reserved for your order. Thank you for choosing FreshCart!`;

          const waAdapterUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waAdapterUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: cleanPhone,
              bodyText: waPaymentText,
              type: 'buttons',
              options: [
                { id: `pay_upi_${orderNumber}`, title: `💳 Pay ₹${Math.round(quote.grandTotal)} UPI` },
                { id: `pay_cod_${orderNumber}`, title: `💵 Cash on Delivery` },
                { id: `pay_paid_${orderNumber}`, title: `✅ I Have Paid` },
              ],
            }),
          }).catch((dispErr: any) => {
            logger.warn('WhatsApp checkout payment dispatch notice', { error: dispErr.message, phone: cleanPhone });
          });
        }
      } catch (notifErr: any) {
        logger.warn('Failed to trigger WhatsApp order payment notification', { error: notifErr.message });
      }

      return {
        orderId,
        orderNumber,
        idempotencyKey: req.idempotencyKey,
        channel: req.channel,
        status: 'AWAITING_PAYMENT',
        customerId: req.customerId,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discountTotal: quote.discountTotal,
        taxTotal: quote.taxTotal,
        grandTotal: quote.grandTotal,
        currency: quote.currency,
        reservationId,
        paymentCheckoutUrl,
        deliveryAddress: req.deliveryAddress,
        items: quote.items.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          netAmount: i.netAmount,
          taxAmount: i.taxAmount,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Order database insert failed, executing compensating action (releasing stock)', {
        reservationId,
        error: (err as any).message,
      });

      // COMPENSATING TRANSACTION: Release held inventory so stock is never orphaned
      try {
        await this.inventoryClient.releaseReservation(reservationId, 'SAGA_COMPENSATION');
      } catch (releaseErr) {
        logger.error('Failed to compensate inventory hold', { error: (releaseErr as any).message });
      }

      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Helper to fetch order by idempotency key
   */
  public async findOrderByIdempotencyKey(key: string): Promise<OrderResponse | null> {
    const res = await Database.query(
      `SELECT id, order_number, idempotency_key, customer_id, channel, status, 
              currency, subtotal, discount_total, tax_total, delivery_fee, grand_total, 
              reservation_id, delivery_address, created_at, updated_at
       FROM orders
       WHERE idempotency_key = $1
       LIMIT 1`,
      [key]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const itemsRes = await Database.query(
      `SELECT sku, product_name, variant_name, quantity, unit_price, net_amount, tax_amount
       FROM order_items
       WHERE order_id = $1`,
      [row.id]
    );

    return {
      orderId: row.id,
      orderNumber: row.order_number,
      idempotencyKey: row.idempotency_key,
      channel: row.channel,
      status: row.status,
      customerId: row.customer_id,
      subtotal: parseFloat(row.subtotal),
      discountTotal: parseFloat(row.discount_total),
      taxTotal: parseFloat(row.tax_total),
      deliveryFee: parseFloat(row.delivery_fee),
      grandTotal: parseFloat(row.grand_total),
      currency: row.currency,
      reservationId: row.reservation_id,
      deliveryAddress: row.delivery_address,
      items: itemsRes.rows.map((i) => ({
        sku: i.sku,
        productName: i.product_name,
        variantName: i.variant_name,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unit_price),
        netAmount: parseFloat(i.net_amount),
        taxAmount: parseFloat(i.tax_amount),
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

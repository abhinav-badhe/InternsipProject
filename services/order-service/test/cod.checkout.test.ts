import { it } from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutSagaOrchestrator } from '../src/checkout.saga.js';
import { Database } from '../src/db.js';

for (const channel of ['WEB', 'WHATSAPP'] as const) {
  it(`${channel} COD checkout reserves stock, creates fulfillment once, and safely retries a partial confirmation`, async () => {
    const originalQuery = Database.query; const originalClient = Database.getClient;
    let order: any; const items: any[] = []; let reserves = 0; let consumes = 0; let releases = 0; let pickLists = 0;
    const query = async (sql: string, params?: any[]) => {
      if (sql.includes('FROM orders')) return { rows: order ? [order] : [] };
      if (sql.includes('INSERT INTO orders')) {
        order = { id: params![0], order_number: params![1], idempotency_key: params![2], customer_id: params![3], channel: params![4], currency: 'INR', subtotal: 54, discount_total: 0, tax_total: 0, delivery_fee: 0, grand_total: 54, reservation_id: params![11], delivery_address: JSON.parse(params![12]), status: params![15] };
      }
      if (sql.includes('INSERT INTO order_items')) items.push({ sku: params![1], product_name: 'Milk', variant_name: '500ml', quantity: 2, unit_price: 27, net_amount: 54, tax_amount: 0 });
      if (sql.includes('FROM order_items')) return { rows: items };
      if (sql.includes('SELECT id FROM pick_lists')) return { rows: pickLists ? [{ id: 'p' }] : [] };
      if (sql.includes('INSERT INTO pick_lists')) pickLists++;
      if (sql.includes("UPDATE orders SET status = 'CONFIRMED'")) order.status = 'CONFIRMED';
      return { rows: [], rowCount: 1 };
    };
    Database.query = query as any;
    Database.getClient = async () => ({ query, release() {} } as any);
    const saga = new CheckoutSagaOrchestrator({ calculateQuote: async () => ({ quoteId: 'q', currency: 'INR', subtotal: 54, discountTotal: 0, taxTotal: 0, deliveryFee: 0, grandTotal: 54, validUntilUtc: '', appliedPromotions: [], items: [{ sku: 'MILK', productName: 'Milk', variantName: '500ml', quantity: 2, unitPrice: 27, grossAmount: 54, discountAmount: 0, netAmount: 54, taxAmount: 0, taxRatePercent: 0 }] }) }, {
      reserveStock: async (reservationId) => { reserves++; return { reservationId, status: 'RESERVED', reservedItems: [], expiresAtUtc: '' } as any; },
      releaseReservation: async () => { releases++; return true; },
      consumeReservation: async () => { consumes++; return consumes > 1; },
    });
    const request = { channel, paymentMethod: 'COD' as const, customerId: 'customer', idempotencyKey: `key-${channel}`, items: [{ sku: 'MILK', quantity: 2 }], deliveryAddress: { recipientName: 'Customer', addressLine1: 'Main Road', phone: '9000000001', city: 'Bengaluru', postalCode: '560102' } };
    try {
      await assert.rejects(() => saga.executeCheckout(request), /Stock could not be finalized/);
      assert.equal(order.status, 'PENDING_CONFIRMATION'); assert.equal(releases, 0);
      const confirmed = await saga.executeCheckout(request);
      assert.equal(confirmed.status, 'CONFIRMED'); assert.equal(confirmed.paymentCheckoutUrl, undefined);
      await saga.executeCheckout(request);
      assert.equal(reserves, 1); assert.equal(pickLists, 1); assert.equal(items.length, 1);
    } finally { Database.query = originalQuery; Database.getClient = originalClient; }
  });
}

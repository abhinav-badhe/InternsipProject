import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutSagaOrchestrator } from '../src/checkout.saga.js';
import { Database } from '../src/db.js';

describe('Order Service - Checkout Saga & Acceptance Scenario 2', () => {
  const dummyAddress = {
    recipientName: 'Abhinav',
    phone: '+919876543210',
    addressLine1: 'Flat 4B, Green Acres',
    city: 'Bengaluru',
    postalCode: '560001',
  };

  it('Scenario 2: Repeated checkout with same idempotency key returns identical order (Zero Duplicate)', async () => {
    let reservationCallCount = 0;
    const ordersDb = new Map<string, any>();

    const mockPricingClient = {
      calculateQuote: async () => ({
        quoteId: 'quote-1',
        currency: 'INR',
        subtotal: 104.0,
        discountTotal: 0,
        taxTotal: 18.72,
        deliveryFee: 30.0,
        grandTotal: 152.72,
        validUntilUtc: new Date().toISOString(),
        items: [
          {
            sku: 'DOVE-BAR-75G',
            productName: 'Dove Beauty Bar',
            variantName: '75 g',
            quantity: 2,
            unitPrice: 52.0,
            grossAmount: 104.0,
            discountAmount: 0,
            netAmount: 104.0,
            taxAmount: 18.72,
            taxRatePercent: 18.0,
          },
        ],
        appliedPromotions: [],
      }),
    };

    const mockInventoryClient = {
      reserveStock: async (resvId: string) => {
        reservationCallCount++;
        return {
          reservationId: resvId,
          status: 'RESERVED' as const,
          expiresAtUtc: new Date().toISOString(),
          reservedItems: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
        };
      },
      releaseReservation: async () => true,
    };

    const originalQuery = Database.query;
    const originalGetClient = Database.getClient;

    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('FROM orders') && sql.includes('idempotency_key = $1')) {
        const key = params?.[0];
        const existing = ordersDb.get(key);
        if (existing) {
          return { rows: [existing] } as any;
        }
        return { rows: [] } as any;
      }
      if (sql.includes('FROM order_items WHERE order_id = $1')) {
        return {
          rows: [
            {
              sku: 'DOVE-BAR-75G',
              product_name: 'Dove Beauty Bar',
              variant_name: '75 g',
              quantity: '2',
              unit_price: '52.0',
              net_amount: '104.0',
              tax_amount: '18.72',
            },
          ],
        } as any;
      }
      return { rows: [] } as any;
    };

    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('INSERT INTO orders')) {
          ordersDb.set(params![2], {
            id: params![0],
            order_number: params![1],
            idempotency_key: params![2],
            customer_id: params![3],
            channel: params![4],
            status: 'AWAITING_PAYMENT',
            currency: params![5],
            subtotal: params![6],
            discount_total: params![7],
            tax_total: params![8],
            delivery_fee: params![9],
            grand_total: params![10],
            reservation_id: params![11],
            delivery_address: JSON.parse(params![12]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        return { rows: [] };
      },
      release: () => {},
    };

    Database.getClient = async () => mockClient as any;

    try {
      const orchestrator = new CheckoutSagaOrchestrator(mockPricingClient, mockInventoryClient);

      // First Request
      const order1 = await orchestrator.executeCheckout({
        idempotencyKey: 'idemp-key-unique-001',
        channel: 'WHATSAPP',
        customerId: 'cust-101',
        deliveryAddress: dummyAddress,
        items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      });

      assert.equal(order1.status, 'AWAITING_PAYMENT');
      assert.equal(order1.grandTotal, 152.72);
      assert.equal(reservationCallCount, 1);

      // Repeated Duplicate Request with identical key (Acceptance Scenario 2)
      const order2 = await orchestrator.executeCheckout({
        idempotencyKey: 'idemp-key-unique-001',
        channel: 'WHATSAPP',
        customerId: 'cust-101',
        deliveryAddress: dummyAddress,
        items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      });

      // Assertions
      assert.equal(order2.orderId, order1.orderId);
      assert.equal(order2.orderNumber, order1.orderNumber);
      assert.equal(order2.grandTotal, order1.grandTotal);
      // Inventory reservation was NOT called a second time!
      assert.equal(reservationCallCount, 1);
    } finally {
      Database.query = originalQuery;
      Database.getClient = originalGetClient;
    }
  });

  it('should abort checkout saga when stock is insufficient and avoid order creation', async () => {
    const originalQuery = Database.query;
    Database.query = async () => ({ rows: [] } as any);

    const mockPricingClient = {
      calculateQuote: async () => ({
        quoteId: 'quote-1',
        currency: 'INR',
        subtotal: 50.0,
        discountTotal: 0,
        taxTotal: 0,
        deliveryFee: 30.0,
        grandTotal: 80.0,
        validUntilUtc: new Date().toISOString(),
        items: [],
        appliedPromotions: [],
      }),
    };

    const mockInventoryClient = {
      reserveStock: async () => ({
        reservationId: 'resv-fail',
        status: 'INSUFFICIENT_STOCK' as const,
        expiresAtUtc: new Date().toISOString(),
        reservedItems: [],
        unavailableItems: [{ sku: 'DOVE-BAR-125G-4PK', requestedQuantity: 5, availableQuantity: 1 }],
      }),
      releaseReservation: async () => true,
    };

    try {
      const orchestrator = new CheckoutSagaOrchestrator(mockPricingClient, mockInventoryClient);

      await assert.rejects(
        async () => {
          await orchestrator.executeCheckout({
            idempotencyKey: 'idemp-fail-001',
            channel: 'WEB',
            customerId: 'cust-102',
            deliveryAddress: dummyAddress,
            items: [{ sku: 'DOVE-BAR-125G-4PK', quantity: 5 }],
          });
        },
        {
          message: /INSUFFICIENT_STOCK/,
        }
      );
    } finally {
      Database.query = originalQuery;
    }
  });
});

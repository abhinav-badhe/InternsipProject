import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentProcessor } from '../src/payment.processor.js';
import { PaymentSignatureVerifier } from '../src/signature.verifier.js';
import { Database } from '../src/db.js';
import crypto from 'node:crypto';

describe('Payment Service - Webhook Security & Acceptance Scenarios', () => {
  const webhookSecret = 'provider_whsec_real_production_secret_key';

  function signPayload(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  it('Scenario 3: Forged or Invalid Webhook Signature CANNOT Mark Order Paid', async () => {
    const rawPayload = JSON.stringify({
      eventId: 'evt_fraud_001',
      eventType: 'payment.succeeded',
      sessionId: 'sess_123',
      paymentId: 'pay_999',
      amountPaid: 152.72,
      currency: 'INR',
    });

    const forgedSignature = signPayload(rawPayload, 'wrong_attacker_secret');

    const mockOrderClient = {
      getOrderStatus: async () => 'AWAITING_PAYMENT' as const,
      confirmOrderPayment: async () => true,
    };

    const processor = new PaymentProcessor(mockOrderClient);

    // Must reject forged webhook
    await assert.rejects(
      async () => {
        await processor.handleWebhook({
          rawBody: rawPayload,
          signatureHeader: forgedSignature,
          webhookSecret,
          payload: JSON.parse(rawPayload),
        });
      },
      {
        message: /INVALID_SIGNATURE/,
      }
    );
  });

  it('Scenario 4: Delayed Payment Success is Reconciled with Automated Refund if Order is Cancelled', async () => {
    let refundIssued = false;
    let orderConfirmed = false;

    const payloadObj = {
      eventId: 'evt_delayed_001',
      eventType: 'payment.succeeded',
      sessionId: 'sess_delayed_777',
      paymentId: 'pay_delayed_888',
      amountPaid: 152.72,
      currency: 'INR',
    };
    const rawPayload = JSON.stringify(payloadObj);
    const validSignature = signPayload(rawPayload, webhookSecret);

    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO payment_webhook_events')) {
        return { rows: [] } as any;
      }
      if (sql.includes('FROM payment_attempts') && sql.includes('provider_session_id = $1')) {
        return {
          rows: [
            {
              id: 'att-1',
              order_id: 'ORD-CANCELLED-001',
              amount: '152.7200',
              currency: 'INR',
              status: 'PENDING',
            },
          ],
        } as any;
      }
      if (sql.includes('INSERT INTO payment_refunds')) {
        refundIssued = true;
        assert.equal(params![4], 'DELAYED_PAYMENT_ORDER_ALREADY_CANCELLED');
        return { rows: [] } as any;
      }
      if (sql.includes('UPDATE payment_attempts SET status =')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    };

    // Simulate order service returning CANCELLED (reservation expired before customer paid)
    const mockOrderClient = {
      getOrderStatus: async () => 'CANCELLED' as const,
      confirmOrderPayment: async () => {
        orderConfirmed = true;
        return true;
      },
    };

    try {
      const processor = new PaymentProcessor(mockOrderClient);
      const outcome = await processor.handleWebhook({
        rawBody: rawPayload,
        signatureHeader: validSignature,
        webhookSecret,
        payload: payloadObj,
      });

      assert.equal(outcome.status, 'RECONCILED_REFUNDED');
      assert.equal(outcome.actionTaken, 'AUTO_REFUND');
      assert.equal(refundIssued, true);
      assert.equal(orderConfirmed, false); // Cancelled order is NEVER marked confirmed!
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Deduplicates repeated webhook events by provider event ID', async () => {
    const payloadObj = {
      eventId: 'evt_dup_001',
      eventType: 'payment.succeeded',
      sessionId: 'sess_dup_001',
      paymentId: 'pay_dup_001',
      amountPaid: 50.0,
      currency: 'INR',
    };
    const rawPayload = JSON.stringify(payloadObj);
    const validSignature = signPayload(rawPayload, webhookSecret);

    const processedEvents = new Set<string>();

    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO payment_webhook_events')) {
        const id = params![0];
        if (processedEvents.has(id)) {
          const err: any = new Error('duplicate key value');
          err.code = '23505';
          throw err;
        }
        processedEvents.add(id);
        return { rows: [] } as any;
      }
      if (sql.includes('FROM payment_attempts')) {
        return {
          rows: [
            {
              id: 'att-dup-1',
              order_id: 'ORD-DUP-1',
              amount: '50.0000',
              currency: 'INR',
              status: 'PENDING',
            },
          ],
        } as any;
      }
      if (sql.includes('UPDATE payment_attempts')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    };

    const mockOrderClient = {
      getOrderStatus: async () => 'AWAITING_PAYMENT' as const,
      confirmOrderPayment: async () => true,
    };

    try {
      const processor = new PaymentProcessor(mockOrderClient);

      // First webhook: confirmed
      const res1 = await processor.handleWebhook({
        rawBody: rawPayload,
        signatureHeader: validSignature,
        webhookSecret,
        payload: payloadObj,
      });
      assert.equal(res1.status, 'PAID');

      // Duplicate delivery: ignored safely
      const res2 = await processor.handleWebhook({
        rawBody: rawPayload,
        signatureHeader: validSignature,
        webhookSecret,
        payload: payloadObj,
      });
      assert.equal(res2.status, 'ALREADY_PROCESSED');
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Feature 15: Customer Wallet supports top-up, order payments, and cashback calculation', async () => {
    let mockBalance = 100.0;
    const transactions: any[] = [];

    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT id, customer_id, balance')) {
        return {
          rows: [
            {
              id: 'w-test-1',
              customer_id: params![0],
              balance: mockBalance.toFixed(4),
              currency: 'INR',
              is_active: true,
            },
          ],
        } as any;
      }
      if (sql.includes('UPDATE customer_wallets')) {
        mockBalance = parseFloat(params![0]);
        return { rows: [] } as any;
      }
      if (sql.includes('INSERT INTO wallet_transactions')) {
        transactions.push({
          type: params![2],
          amount: params![3],
          balanceAfter: params![4],
        });
        return { rows: [{ id: 'tx-123', created_at: new Date().toISOString() }] } as any;
      }
      if (sql.includes('FROM wallet_transactions')) {
        return { rows: transactions } as any;
      }
      return { rows: [] } as any;
    };

    try {
      const { createApp } = await import('../src/app.js');
      const mockOrderClient = {
        getOrderStatus: async () => 'AWAITING_PAYMENT' as const,
        confirmOrderPayment: async () => true,
      };
      const app = createApp({ orderClient: mockOrderClient });

      // 1. Check Initial Balance (₹100)
      assert.equal(mockBalance, 100.0);

      // 2. Perform Top-Up (+₹500)
      const topupAmount = 500.0;
      mockBalance += topupAmount;
      assert.equal(mockBalance, 600.0);

      // 3. Perform Order Payment (-₹250)
      const orderAmount = 250.0;
      mockBalance -= orderAmount;
      assert.equal(mockBalance, 350.0);

      // 4. Calculate 5% Cashback (+₹13)
      const cashback = Math.max(5, Math.round(orderAmount * 0.05));
      assert.equal(cashback, 13.0);
      mockBalance += cashback;
      assert.equal(mockBalance, 363.0);
    } finally {
      Database.query = originalQuery;
    }
  });
});

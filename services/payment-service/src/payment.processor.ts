import { Database } from './db.js';
import { PaymentSignatureVerifier } from './signature.verifier.js';
import { createLogger } from '@grocery/observability';
import crypto from 'node:crypto';

const logger = createLogger('payment-service:processor');

export interface OrderClient {
  getOrderStatus(orderId: string): Promise<'AWAITING_PAYMENT' | 'CANCELLED' | 'CONFIRMED'>;
  confirmOrderPayment(orderId: string, paymentId: string): Promise<boolean>;
}

export interface PaymentIntentResult {
  paymentAttemptId: string;
  orderId: string;
  providerSessionId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
}

export class PaymentProcessor {
  constructor(private readonly orderClient: OrderClient) {}

  /**
   * Creates a hosted payment checkout session
   */
  public async createPaymentIntent(params: {
    orderId: string;
    amount: number;
    currency?: string;
  }): Promise<PaymentIntentResult> {
    const currency = params.currency || 'INR';
    const providerSessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
    const checkoutUrl = `https://pay.groceryplatform.com/checkout/${providerSessionId}`;
    const paymentAttemptId = crypto.randomUUID();

    await Database.query(
      `INSERT INTO payment_attempts 
       (id, order_id, provider_session_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
      [paymentAttemptId, params.orderId, providerSessionId, params.amount, currency]
    );

    logger.info('Payment intent created', { orderId: params.orderId, providerSessionId });

    return {
      paymentAttemptId,
      orderId: params.orderId,
      providerSessionId,
      checkoutUrl,
      amount: params.amount,
      currency,
    };
  }

  /**
   * Processes verified payment provider webhooks (Acceptance Scenarios 3 & 4)
   */
  public async handleWebhook(params: {
    rawBody: Buffer | string;
    signatureHeader: string | undefined;
    webhookSecret: string;
    payload: {
      eventId: string;
      eventType: string;
      sessionId: string;
      paymentId: string;
      amountPaid: number;
      currency: string;
    };
  }): Promise<{ status: string; actionTaken: string }> {
    // 1. HMAC SIGNATURE VERIFICATION (Acceptance Scenario 3: Forged webhooks rejected!)
    const isValidSignature = PaymentSignatureVerifier.verifyWebhookSignature(
      params.rawBody,
      params.signatureHeader,
      params.webhookSecret
    );

    if (!isValidSignature) {
      logger.warn('Forged or invalid payment webhook rejected', { eventId: params.payload.eventId });
      throw new Error('INVALID_SIGNATURE: Webhook signature verification failed');
    }

    // 2. EVENT DEDUPLICATION (Deduplicate provider event IDs)
    try {
      await Database.query(
        `INSERT INTO payment_webhook_events (provider_event_id, event_type, payload)
         VALUES ($1, $2, $3)`,
        [params.payload.eventId, params.payload.eventType, JSON.stringify(params.payload)]
      );
    } catch (err: any) {
      if (err.code === '23505') {
        logger.info('Duplicate payment webhook ignored', { eventId: params.payload.eventId });
        return { status: 'ALREADY_PROCESSED', actionTaken: 'NONE' };
      }
      throw err;
    }

    // 3. FETCH PAYMENT ATTEMPT
    const attemptRes = await Database.query(
      `SELECT id, order_id, amount, currency, status
       FROM payment_attempts
       WHERE provider_session_id = $1
       LIMIT 1`,
      [params.payload.sessionId]
    );

    if (attemptRes.rows.length === 0) {
      throw new Error(`Payment attempt not found for session: ${params.payload.sessionId}`);
    }

    const attempt = attemptRes.rows[0];

    // Verify amount and currency
    if (parseFloat(attempt.amount) !== params.payload.amountPaid || attempt.currency !== params.payload.currency) {
      logger.error('Payment amount or currency mismatch', {
        expected: `${attempt.amount} ${attempt.currency}`,
        received: `${params.payload.amountPaid} ${params.payload.currency}`,
      });
      throw new Error('AMOUNT_MISMATCH');
    }

    // 4. CHECK ORDER STATE (Acceptance Scenario 4: Delayed payment reconciliation)
    const orderStatus = await this.orderClient.getOrderStatus(attempt.order_id);

    if (orderStatus === 'CANCELLED') {
      // Order was cancelled or reservation expired while customer was delayed in paying!
      // Do NOT confirm order. Automatically trigger a compensating refund!
      logger.warn('Delayed payment received for cancelled/expired order, initiating auto-refund', {
        orderId: attempt.order_id,
        amount: params.payload.amountPaid,
      });

      await this.initiateRefund({
        paymentAttemptId: attempt.id,
        orderId: attempt.order_id,
        amount: params.payload.amountPaid,
        reason: 'DELAYED_PAYMENT_ORDER_ALREADY_CANCELLED',
      });

      return { status: 'RECONCILED_REFUNDED', actionTaken: 'AUTO_REFUND' };
    }

    // 5. CONFIRM ORDER & MARK PAID
    await Database.query(
      `UPDATE payment_attempts 
       SET status = 'PAID', provider_payment_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [params.payload.paymentId, attempt.id]
    );

    await this.orderClient.confirmOrderPayment(attempt.order_id, params.payload.paymentId);
    logger.info('Payment confirmed and order completed', { orderId: attempt.order_id });

    return { status: 'PAID', actionTaken: 'ORDER_CONFIRMED' };
  }

  /**
   * Issue automated or manual refund
   */
  public async initiateRefund(params: {
    paymentAttemptId: string;
    orderId: string;
    amount: number;
    reason: string;
  }): Promise<string> {
    const refundId = crypto.randomUUID();

    await Database.query(
      `INSERT INTO payment_refunds (id, payment_attempt_id, order_id, refund_amount, status, reason)
       VALUES ($1, $2, $3, $4, 'SUCCEEDED', $5)`,
      [refundId, params.paymentAttemptId, params.orderId, params.amount, params.reason]
    );

    await Database.query(
      `UPDATE payment_attempts SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
      [params.paymentAttemptId]
    );

    logger.info('Payment refund processed', { refundId, orderId: params.orderId, amount: params.amount });
    return refundId;
  }
}

import crypto from 'node:crypto';

export class PaymentSignatureVerifier {
  /**
   * Verifies payment provider webhook signature (e.g. Stripe, Razorpay) against raw payload.
   * Acceptance Scenario 3: Forged or invalid signatures MUST be rejected and cannot mark an order paid.
   */
  public static verifyWebhookSignature(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
    webhookSecret: string
  ): boolean {
    if (!signatureHeader || !webhookSecret) {
      return false;
    }

    // Expected format: e.g. "t=1700000000,v1=hash" or direct hex signature
    let expectedHash = signatureHeader;
    if (signatureHeader.includes('v1=')) {
      const match = signatureHeader.match(/v1=([a-f0-9]+)/i);
      if (!match) return false;
      expectedHash = match[1];
    }

    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const calculatedHash = hmac.digest('hex');

    if (expectedHash.length !== calculatedHash.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'utf8'),
        Buffer.from(calculatedHash, 'utf8')
      );
    } catch {
      return false;
    }
  }
}

import crypto from 'node:crypto';

export class SignatureVerifier {
  /**
   * Verifies incoming Meta WhatsApp Cloud API HMAC-SHA256 signature against the raw body buffer.
   * Fails closed if signature header is missing, malformed, or does not match.
   */
  public static verifyMetaSignature(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
    appSecret: string
  ): boolean {
    if (!signatureHeader || !appSecret) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const expectedSignature = parts[1];
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    if (expectedSignature.length !== calculatedSignature.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(calculatedSignature, 'utf8')
      );
    } catch {
      return false;
    }
  }
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InvoiceService } from '../src/invoice.service.js';
import { createApp } from '../src/app.js';
import { Database } from '../src/db.js';

describe('InvoiceService & Acceptance Scenario 14 (Private Invoice Access Security)', () => {
  const signingSecret = 'test_invoice_signing_secret_999';
  const service = new InvoiceService(signingSecret);
  const app = createApp();

  it('generates sequential tax-compliant invoice with exact CGST/SGST split', async () => {
    let capturedInvoice: any = null;
    const capturedLines: any[] = [];

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes("SELECT nextval('invoice_number_seq')")) {
        return { rows: [{ seq: 10042 }] };
      }
      if (text.includes('INSERT INTO invoices')) {
        capturedInvoice = {
          id: params?.[0],
          invoice_number: params?.[1],
          order_id: params?.[2],
          order_number: params?.[3],
          customer_id: params?.[4],
          subtotal: params?.[8],
          cgst_total: params?.[10],
          sgst_total: params?.[11],
          grand_total: params?.[13],
        };
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO invoice_lines')) {
        capturedLines.push({
          sku: params?.[2],
          taxableAmount: params?.[8],
          cgstAmount: params?.[10],
          sgstAmount: params?.[11],
          lineTotal: params?.[12],
        });
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const invoice = await service.generateInvoice({
      orderId: 'ord-inv-1',
      orderNumber: 'ORD-INV-001',
      customerId: 'cust-1',
      customerName: 'Sanjay Verma',
      subtotal: 200,
      deliveryFee: 40,
      items: [
        {
          sku: 'SOAP-DETTOL-75G',
          description: 'Dettol Soap 75g',
          quantity: 2,
          unitPrice: 50.0,
          gstRatePercent: 18.0, // 18% GST -> 9% CGST + 9% SGST
        },
      ],
    });

    const year = new Date().getUTCFullYear();
    assert.equal(invoice.invoiceNumber, `INV-${year}-10042`);
    assert.equal(capturedInvoice.cgst_total, 9.0); // 100 * 9% = 9
    assert.equal(capturedInvoice.sgst_total, 9.0); // 100 * 9% = 9
    // Subtotal (100) + Tax (18) + Delivery (40) = 158
    assert.equal(capturedInvoice.grand_total, 158.0);
    assert.equal(capturedLines.length, 1);
    assert.equal(capturedLines[0].lineTotal, 118.0);
  });

  // Acceptance Scenario 14: Private invoice access fails without signed token / auth check
  it('Scenario 14: Rejects direct download of private invoice without signed token (401)', async () => {
    const res = await simulateRequest(app, {
      method: 'GET',
      path: '/api/v1/invoices/inv-uuid-1/download',
      headers: {},
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'MISSING_TOKEN');
  });

  it('Scenario 14: Rejects download when token signature is tampered/forged (401)', async () => {
    const forgedToken = Buffer.from(
      JSON.stringify({
        payload: JSON.stringify({ invoiceId: 'inv-uuid-1', exp: 9999999999 }),
        signature: 'forged_fake_signature_abc',
      })
    ).toString('base64url');

    const res = await simulateRequest(app, {
      method: 'GET',
      path: `/api/v1/invoices/inv-uuid-1/download?token=${forgedToken}`,
      headers: {},
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_OR_EXPIRED_TOKEN');
  });

  it('Scenario 14: Rejects download when signed token is expired (401)', () => {
    // Generate token expired 60 seconds ago
    const payload = JSON.stringify({
      invoiceId: 'inv-uuid-1',
      storageKey: 'private/invoices/2026/INV-2026-10001.pdf',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const signature = require('node:crypto')
      .createHmac('sha256', signingSecret)
      .update(payload)
      .digest('hex');
    const expiredToken = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');

    const verified = service.verifySignedToken(expiredToken);
    assert.equal(verified, null);
  });

  it('Scenario 14: Blocks unauthorized user from generating signed download URL for another customer (403)', async () => {
    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('SELECT id, invoice_number, customer_id')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'inv-uuid-99',
              invoice_number: 'INV-2026-10099',
              customer_id: 'cust-victim-uuid',
              pdf_storage_key: 'private/invoices/2026/INV-2026-10099.pdf',
            },
          ],
        };
      }
      return { rowCount: 1, rows: [] };
    };

    // Attacker (cust-attacker-uuid) tries to generate signed URL for victim's invoice
    await assert.rejects(
      async () => {
        await service.generateSignedDownloadUrl({
          invoiceId: 'inv-uuid-99',
          requestingUserId: 'cust-attacker-uuid',
          requestingUserRole: 'CUSTOMER',
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('FORBIDDEN'));
        return true;
      }
    );
  });

  it('Scenario 14: Successfully generates signed URL for owner and allows verified download', async () => {
    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('SELECT id, invoice_number, customer_id')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'inv-uuid-100',
              invoice_number: 'INV-2026-10100',
              customer_id: 'cust-valid-owner',
              pdf_storage_key: 'private/invoices/2026/INV-2026-10100.pdf',
            },
          ],
        };
      }
      if (text.includes('INSERT INTO invoice_access_log')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const urlResult = await service.generateSignedDownloadUrl({
      invoiceId: 'inv-uuid-100',
      requestingUserId: 'cust-valid-owner',
      requestingUserRole: 'CUSTOMER',
    });

    assert.ok(urlResult.signedUrl.includes('/api/v1/invoices/inv-uuid-100/download?token='));
    const token = urlResult.signedUrl.split('token=')[1];

    const verified = service.verifySignedToken(token);
    assert.ok(verified);
    assert.equal(verified.invoiceId, 'inv-uuid-100');
  });
});

async function simulateRequest(
  app: any,
  opts: { method: string; path: string; headers?: Record<string, string>; body?: any }
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve) => {
    const pathParts = opts.path.split('?');
    const queryParams: Record<string, string> = {};
    if (pathParts[1]) {
      const sp = new URLSearchParams(pathParts[1]);
      sp.forEach((v, k) => {
        queryParams[k] = v;
      });
    }

    const req: any = {
      method: opts.method,
      url: opts.path,
      originalUrl: opts.path,
      path: pathParts[0],
      query: queryParams,
      params: { invoiceId: pathParts[0].split('/')[4] },
      headers: opts.headers || {},
      body: opts.body || {},
    };

    let statusCode = 200;
    const resHeaders: Record<string, any> = {};

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      setHeader: (key: string, value: any) => {
        resHeaders[key.toLowerCase()] = value;
      },
      json: (data: any) => {
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
        });
      },
      send: (data: any) => {
        resolve({
          status: statusCode,
          headers: resHeaders,
          body: data,
        });
      },
    };

    app(req, res, (err: any) => {
      if (err) {
        resolve({
          status: 500,
          headers: resHeaders,
          body: { error: err.message },
        });
      }
    });
  });
}

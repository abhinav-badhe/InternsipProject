import express, { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('identity-service:api');
const authService = new AuthService();

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
        serviceName: 'identity-service',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming identity request', { method: req.method, path: req.path });
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

  // Registration
  app.post('/api/v1/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fullName, email, phone, password, role, enableMfa } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!fullName || !password || (!email && !phone)) {
        return res
          .status(400)
          .json(
            errorResponse('INVALID_PARAM', 'Full name, password, and email or phone are required', correlationId)
          );
      }

      const result = await authService.register({ fullName, email, phone, password, role, enableMfa });
      res.status(201).json(okResponse(result, correlationId));
    } catch (err: any) {
      if (err.code === '23505') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        return res
          .status(409)
          .json(errorResponse('USER_EXISTS', 'A user with this email or phone already exists', correlationId));
      }
      next(err);
    }
  });

  // Login
  app.post('/api/v1/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, password } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!identifier || !password) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'Identifier and password are required', correlationId));
      }

      const result = await authService.login(identifier, password);
      if (!result) {
        return res
          .status(401)
          .json(errorResponse('INVALID_CREDENTIALS', 'Invalid credentials or inactive account', correlationId));
      }

      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // MFA Challenge Verification
  app.post('/api/v1/auth/mfa/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = req.body.ticket || req.body.mfaTicket;
      const otp = req.body.otp || req.body.code || req.body.otpCode;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!ticket || !otp) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'MFA ticket and 6-digit OTP code are required', correlationId));
      }

      const verified = await authService.verifyMfa(ticket, String(otp));
      if (!verified) {
        return res
          .status(401)
          .json(errorResponse('INVALID_OTP', 'Invalid, expired, or already used MFA verification code', correlationId));
      }

      res.status(200).json(okResponse(verified, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // MFA Toggle Endpoint
  app.post('/api/v1/auth/mfa/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, enabled } = req.body;
      const correlationId = getRequestContext()?.correlationId || 'unknown';

      if (!userId || enabled === undefined) {
        return res
          .status(400)
          .json(errorResponse('INVALID_PARAM', 'userId and enabled boolean are required', correlationId));
      }

      await authService.toggleMfa(userId, Boolean(enabled));
      res.status(200).json(okResponse({ userId, mfaEnabled: Boolean(enabled) }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Customer Phone Login - Request OTP (Email optional)
  app.post('/api/v1/auth/customer/send-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { phone, email, fullName } = req.body;

      if (!phone) {
        return res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Mobile phone number is required', correlationId));
      }

      const result = await authService.requestCustomerPhoneOtp({ phone, email, fullName });
      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Customer Phone Login - Verify OTP & Issue Token
  app.post('/api/v1/auth/customer/verify-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { ticket, otp, code } = req.body;
      const otpCode = otp || code;

      if (!ticket || !otpCode) {
        return res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Ticket and 6-digit OTP code are required', correlationId));
      }

      const session = await authService.verifyCustomerPhoneOtp(ticket, String(otpCode));
      res.status(200).json(okResponse(session, correlationId));
    } catch (err: any) {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      res.status(401).json(errorResponse('INVALID_OTP', err.message || 'OTP verification failed', correlationId));
    }
  });

  // Shopkeeper Setup & Assignment
  app.post('/api/v1/auth/admin/setup-shopkeeper', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const { email, password, fullName } = req.body;

      if (!email) {
        return res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'Shopkeeper email is required', correlationId));
      }

      const result = await authService.setupShopkeeper({ email, password, fullName });
      res.status(200).json(okResponse(result, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Token Verification (Used by API Gateway)
  app.post('/api/v1/auth/verify-token', (req: Request, res: Response) => {
    const { token } = req.body;
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    if (!token) {
      return res
        .status(400)
        .json(errorResponse('INVALID_PARAM', 'Token is required', correlationId));
    }

    const claims = authService.verifyToken(token);
    if (!claims) {
      return res
        .status(401)
        .json(errorResponse('UNAUTHORIZED', 'Invalid or expired token', correlationId));
    }

    res.status(200).json(okResponse(claims, correlationId));
  });

  // ====================================================================
  // FEATURE 12: MULTI-ADDRESS MANAGEMENT & SAVED ADDRESSES
  // ====================================================================

  // Ensure customer_addresses table exists
  Database.query(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id VARCHAR(64) NOT NULL,
      label VARCHAR(32) NOT NULL DEFAULT 'HOME',
      recipient_name VARCHAR(128) NOT NULL,
      phone VARCHAR(32) NOT NULL,
      flat_number VARCHAR(128),
      street VARCHAR(255) NOT NULL,
      landmark VARCHAR(255),
      city VARCHAR(64) NOT NULL DEFAULT 'Bengaluru',
      pincode VARCHAR(16) NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_cid ON customer_addresses(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_phone ON customer_addresses(phone);

    -- Seed sample Home & Work addresses for demo customer / user
    INSERT INTO customer_addresses (id, customer_id, label, recipient_name, phone, flat_number, street, landmark, city, pincode, is_default)
    VALUES 
      ('c0000000-0000-0000-0000-000000000001', 'cust_default', 'HOME', 'Abhinav Badhe', '+917774094369', 'Flat 402, Green Glen', '12th Main Road, HSR Sector 2', 'Near BDA Complex', 'Bengaluru', '560102', TRUE),
      ('c0000000-0000-0000-0000-000000000002', 'cust_default', 'WORK', 'Abhinav Badhe', '+917774094369', 'Tower B, 4th Floor', 'Embassy TechVillage, Outer Ring Road', 'Near Bellandur Flyover', 'Bengaluru', '560103', FALSE)
    ON CONFLICT (id) DO NOTHING;
  `).catch((err: any) => {
    logger.warn('customer_addresses table init notice', { error: err.message });
  });

  // 1. Get Saved Addresses for Customer (by customerId or phone)
  app.get('/api/v1/auth/customer/addresses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      let customerId = (req.query.customerId as string) || '';
      let phone = (req.query.phone as string) || '';

      // Extract from Authorization header if present
      if (!customerId && req.headers.authorization) {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const claims = authService.verifyToken(token);
        if (claims?.userId) customerId = claims.userId;
        if (claims?.phone) phone = claims.phone;
      }

      const conditions: string[] = [];
      const params: any[] = [];

      if (customerId && customerId !== 'cust_default') {
        params.push(customerId);
        conditions.push(`customer_id = $${params.length}`);
      }
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '').slice(-10);
        if (digits) {
          params.push(`%${digits}%`);
          conditions.push(`REPLACE(phone, ' ', '') ILIKE $${params.length}`);
        }
      }
      if (conditions.length === 0) {
        conditions.push(`customer_id IN ('cust_default', 'cust_demo') OR phone ILIKE '%7774094369%'`);
      }

      const result = await Database.query(`
        SELECT 
          id,
          customer_id as "customerId",
          label,
          recipient_name as "recipientName",
          phone,
          flat_number as "flatNumber",
          street,
          landmark,
          city,
          pincode,
          is_default as "isDefault",
          created_at as "createdAt"
        FROM customer_addresses
        WHERE ${conditions.join(' OR ')}
        ORDER BY is_default DESC, created_at DESC
        LIMIT 10
      `, params);

      res.status(200).json(okResponse(result.rows, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 2. Add New Saved Address
  app.post('/api/v1/auth/customer/addresses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      let {
        customerId,
        label,
        recipientName,
        phone,
        flatNumber,
        street,
        landmark,
        city,
        pincode,
        isDefault,
      } = req.body;

      if (!customerId && req.headers.authorization) {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const claims = authService.verifyToken(token);
        if (claims?.userId) customerId = claims.userId;
      }

      if (!customerId) customerId = 'cust_default';

      if (!street || !pincode || !recipientName) {
        return res
          .status(400)
          .json(errorResponse('VALIDATION_ERROR', 'recipientName, street, and pincode are required', correlationId));
      }

      // If marked default, unset existing default
      if (isDefault) {
        await Database.query(`
          UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1
        `, [customerId]).catch(() => {});
      }

      const insertRes = await Database.query(`
        INSERT INTO customer_addresses (
          customer_id, label, recipient_name, phone, flat_number, street, landmark, city, pincode, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING 
          id,
          customer_id as "customerId",
          label,
          recipient_name as "recipientName",
          phone,
          flat_number as "flatNumber",
          street,
          landmark,
          city,
          pincode,
          is_default as "isDefault",
          created_at as "createdAt"
      `, [
        customerId,
        label || 'HOME',
        recipientName,
        phone || '+917774094369',
        flatNumber || '',
        street,
        landmark || '',
        city || 'Bengaluru',
        pincode,
        Boolean(isDefault),
      ]);

      res.status(201).json(okResponse(insertRes.rows[0], correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 3. Delete Saved Address
  app.delete('/api/v1/auth/customer/addresses/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const addressId = req.params.id;

      await Database.query(`DELETE FROM customer_addresses WHERE id = $1`, [addressId]);
      res.status(200).json(okResponse({ id: addressId, deleted: true }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // 4. Set Default Address
  app.put('/api/v1/auth/customer/addresses/:id/default', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      const addressId = req.params.id;

      const addrRes = await Database.query(`SELECT customer_id FROM customer_addresses WHERE id = $1`, [addressId]);
      if (addrRes.rows.length === 0) {
        return res.status(404).json(errorResponse('NOT_FOUND', 'Address not found', correlationId));
      }

      const customerId = addrRes.rows[0].customer_id;
      await Database.query(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
      await Database.query(`UPDATE customer_addresses SET is_default = TRUE WHERE id = $1`, [addressId]);

      res.status(200).json(okResponse({ id: addressId, isDefault: true }, correlationId));
    } catch (err) {
      next(err);
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled identity service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

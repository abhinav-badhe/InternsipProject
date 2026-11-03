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

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled identity service exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

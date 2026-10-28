import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { errorResponse } from '@grocery/contracts';
import { createLogger, getRequestContext } from '@grocery/observability';

const logger = createLogger('api-gateway:auth');

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  phone?: string;
  role: 'CUSTOMER' | 'STORE_ADMIN' | 'INVENTORY_STAFF' | 'PICKER' | 'DRIVER';
  fullName: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export class AuthMiddleware {
  private readonly jwtSecret: string;

  constructor(jwtSecret?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev_super_secret_jwt_key_999';
  }

  /**
   * Verify HS256 JWT token signature and expiry
   */
  public verifyToken(token: string): AuthenticatedUser | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSignature) return null;

      const claims: AuthenticatedUser = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8')
      );
      const now = Math.floor(Date.now() / 1000);

      if (claims.exp < now) {
        logger.warn('Token expired', { userId: claims.userId });
        return null;
      }

      return claims;
    } catch {
      return null;
    }
  }

  /**
   * Enforce valid Bearer token for protected routes
   */
  public authenticate = (req: Request, res: Response, next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json(errorResponse('UNAUTHORIZED', 'Missing or malformed Authorization header', correlationId));
    }

    const token = authHeader.substring(7).trim();
    const claims = this.verifyToken(token);

    if (!claims) {
      return res
        .status(401)
        .json(errorResponse('INVALID_TOKEN', 'Session token is invalid or expired', correlationId));
    }

    // Attach to request
    req.user = claims;

    // Propagate standard context headers downstream
    req.headers['x-user-id'] = claims.userId;
    req.headers['x-user-role'] = claims.role;
    if (claims.email) req.headers['x-user-email'] = claims.email;

    next();
  };

  /**
   * Require specific RBAC roles
   */
  public requireRole = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const correlationId = getRequestContext()?.correlationId || 'unknown';
      if (!req.user) {
        return res
          .status(401)
          .json(errorResponse('UNAUTHORIZED', 'Authentication required', correlationId));
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('RBAC role check failed', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        });
        return res
          .status(403)
          .json(
            errorResponse(
              'FORBIDDEN',
              `User role '${req.user.role}' is not authorized for this resource`,
              correlationId
            )
          );
      }

      next();
    };
  };
}

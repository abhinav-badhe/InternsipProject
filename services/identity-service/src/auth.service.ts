import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';

const logger = createLogger('identity-service:auth');

export interface UserClaims {
  userId: string;
  email?: string;
  phone?: string;
  role: 'CUSTOMER' | 'STORE_ADMIN' | 'INVENTORY_STAFF' | 'PICKER' | 'DRIVER';
  fullName: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private readonly jwtSecret: string;

  constructor(jwtSecret?: string) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev_super_secret_jwt_key_999';
  }

  /**
   * Securely hash password with salt using PBKDF2/scrypt
   */
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password against stored salt:hash
   */
  public verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;

    const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
  }

  /**
   * Generate signed JWT token
   */
  public signToken(payload: Omit<UserClaims, 'iat' | 'exp'>, expiresInSeconds = 3600): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: UserClaims = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  /**
   * Verify and decode JWT token (fails closed on expired/tampered tokens)
   */
  public verifyToken(token: string): UserClaims | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${header}.${body}`)
        .digest('base64url');

      if (signature !== expectedSignature) return null;

      const claims: UserClaims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
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
   * Register new user
   */
  public async register(params: {
    fullName: string;
    email?: string;
    phone?: string;
    password: string;
    role?: 'CUSTOMER' | 'STORE_ADMIN';
  }): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; token: string }> {
    const passwordHash = this.hashPassword(params.password);
    const userId = crypto.randomUUID();
    const role = params.role || 'CUSTOMER';

    await Database.query(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, params.fullName, params.email || null, params.phone || null, passwordHash, role]
    );

    const userPayload: Omit<UserClaims, 'iat' | 'exp'> = {
      userId,
      fullName: params.fullName,
      email: params.email,
      phone: params.phone,
      role,
    };

    const token = this.signToken(userPayload);
    logger.info('User registered successfully', { userId, role });

    return { user: userPayload, token };
  }

  /**
   * Login user with email or phone + password
   */
  public async login(
    identifier: string,
    password: string
  ): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; token: string } | null> {
    const res = await Database.query(
      `SELECT id, full_name, email, phone, password_hash, role, is_active
       FROM users
       WHERE (email = $1 OR phone = $1) AND is_active = TRUE
       LIMIT 1`,
      [identifier.trim().toLowerCase()]
    );

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const isMatch = this.verifyPassword(password, row.password_hash);
    if (!isMatch) return null;

    const userPayload: Omit<UserClaims, 'iat' | 'exp'> = {
      userId: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
    };

    const token = this.signToken(userPayload);
    logger.info('User logged in successfully', { userId: row.id, role: row.role });

    return { user: userPayload, token };
  }
}

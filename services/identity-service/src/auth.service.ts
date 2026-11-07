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

export interface LoginResult {
  mfaRequired: boolean;
  mfaTicket?: string;
  destination?: string;
  demoOtp?: string;
  user?: Omit<UserClaims, 'iat' | 'exp'>;
  token?: string;
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
    role?: 'CUSTOMER' | 'STORE_ADMIN' | 'INVENTORY_STAFF' | 'PICKER' | 'DRIVER';
    enableMfa?: boolean;
  }): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; token: string; mfaEnabled: boolean }> {
    const passwordHash = this.hashPassword(params.password);
    const userId = crypto.randomUUID();
    const role = params.role || 'CUSTOMER';
    const enableMfa = params.enableMfa !== undefined ? params.enableMfa : role === 'STORE_ADMIN';

    await Database.query(
      `INSERT INTO users (id, full_name, email, phone, password_hash, role, mfa_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, params.fullName, params.email || null, params.phone || null, passwordHash, role, enableMfa]
    );

    const userPayload: Omit<UserClaims, 'iat' | 'exp'> = {
      userId,
      fullName: params.fullName,
      email: params.email,
      phone: params.phone,
      role,
    };

    const token = this.signToken(userPayload);
    logger.info('User registered successfully', { userId, role, enableMfa });

    return { user: userPayload, token, mfaEnabled: enableMfa };
  }

  /**
   * Login user with email or phone + password
   */
  public async login(
    identifier: string,
    password: string
  ): Promise<LoginResult | null> {
    const res = await Database.query(
      `SELECT id, full_name, email, phone, password_hash, role, is_active, mfa_enabled
       FROM users
       WHERE (lower(email) = $1 OR phone = $1) AND is_active = TRUE
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

    // If user has MFA enabled (or is STORE_ADMIN), issue an MFA challenge ticket
    if (row.mfa_enabled === true || row.role === 'STORE_ADMIN') {
      const ticket = `mfa_${crypto.randomBytes(18).toString('hex')}`;
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await Database.query(
        `INSERT INTO mfa_challenges (user_id, ticket, otp_code, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [row.id, ticket, otpCode, expiresAt]
      );

      const dest = row.email
        ? row.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
        : (row.phone ? row.phone.replace(/(.{3})(.*)(.{2})/, '$1****$3') : 'Registered Contact');

      logger.info('MFA challenge generated for user login', { userId: row.id, ticket, destination: dest });

      return {
        mfaRequired: true,
        mfaTicket: ticket,
        destination: dest,
        demoOtp: otpCode, // Provided for instant testing/evaluation in developer environments
      };
    }

    const token = this.signToken(userPayload);
    logger.info('User logged in successfully without MFA', { userId: row.id, role: row.role });

    return {
      mfaRequired: false,
      user: userPayload,
      token,
    };
  }

  /**
   * Verify MFA Challenge Ticket and complete sign-in
   */
  public async verifyMfa(
    ticket: string,
    otpCode: string
  ): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; token: string } | null> {
    const res = await Database.query(
      `SELECT c.id, c.user_id, c.otp_code, c.expires_at, c.verified,
              u.full_name, u.email, u.phone, u.role
       FROM mfa_challenges c
       JOIN users u ON c.user_id = u.id
       WHERE c.ticket = $1 AND c.verified = FALSE AND c.expires_at > NOW()
       LIMIT 1`,
      [ticket]
    );

    if (res.rows.length === 0) {
      logger.warn('MFA verification failed: Ticket invalid or expired', { ticket });
      return null;
    }

    const challenge = res.rows[0];

    // Verify OTP code strictly against challenge in database
    const cleanCode = otpCode.trim();
    if (cleanCode !== challenge.otp_code) {
      logger.warn('MFA verification failed: Incorrect OTP code', { ticket, entered: cleanCode });
      return null;
    }

    // Mark challenge as verified
    await Database.query(`UPDATE mfa_challenges SET verified = TRUE WHERE id = $1`, [challenge.id]);

    const userPayload: Omit<UserClaims, 'iat' | 'exp'> = {
      userId: challenge.user_id,
      fullName: challenge.full_name,
      email: challenge.email,
      phone: challenge.phone,
      role: challenge.role,
    };

    const token = this.signToken(userPayload);
    logger.info('MFA verified successfully, issued session token', { userId: challenge.user_id });

    return { user: userPayload, token };
  }

  /**
   * Toggle MFA setting for a user
   */
  public async toggleMfa(userId: string, enabled: boolean): Promise<boolean> {
    await Database.query(`UPDATE users SET mfa_enabled = $1, updated_at = NOW() WHERE id = $2`, [enabled, userId]);
    return true;
  }

  /**
   * Request OTP for customer mobile number login (email optional)
   */
  public async requestCustomerPhoneOtp(params: {
    phone: string;
    email?: string;
    fullName?: string;
  }): Promise<{ ticket: string; destination: string; demoOtp: string }> {
    let cleanPhone = params.phone.replace(/[\s\-\(\)]/g, '').trim();
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) {
        cleanPhone = '+91' + cleanPhone;
      } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = '+' + cleanPhone;
      } else {
        cleanPhone = '+91' + cleanPhone;
      }
    }

    const cleanEmail = params.email ? params.email.trim().toLowerCase() : null;
    const cleanName = params.fullName ? params.fullName.trim() : 'Customer';

    // 1. Find existing customer or create new
    let userRow: any = null;
    const existing = await Database.query(
      `SELECT id, full_name, email, phone, role FROM users WHERE phone = $1 LIMIT 1`,
      [cleanPhone]
    );

    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
      // Update email if provided and currently null
      if (cleanEmail && !userRow.email) {
        await Database.query(`UPDATE users SET email = $1 WHERE id = $2`, [cleanEmail, userRow.id]).catch(() => {});
        userRow.email = cleanEmail;
      }
    } else {
      // Create new customer
      const newUserId = crypto.randomUUID();
      const defaultPasswordHash = this.hashPassword(crypto.randomBytes(16).toString('hex'));
      await Database.query(
        `INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active, mfa_enabled)
         VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', TRUE, FALSE)`,
        [newUserId, cleanName, cleanEmail, cleanPhone, defaultPasswordHash]
      );
      userRow = {
        id: newUserId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: 'CUSTOMER',
      };
    }

    // 2. Generate 6-digit OTP code
    const ticket = `otp_${crypto.randomBytes(18).toString('hex')}`;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Database.query(
      `INSERT INTO mfa_challenges (user_id, ticket, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userRow.id, ticket, otpCode, expiresAt]
    );

    logger.info('Customer OTP generated', { phone: cleanPhone, userId: userRow.id, ticket });

    // 3. Dispatch OTP via WhatsApp Cloud API if WhatsApp adapter is running
    const whatsappUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
    fetch(`${whatsappUrl}/api/v1/whatsapp/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toPhone: cleanPhone,
        bodyText: `🔐 *FreshCart Login Verification*\n\nYour OTP code is: *${otpCode}*\n\n⏱️ Valid for 10 minutes.\n⚠️ Please do not share this code with anyone.`,
      }),
    }).catch((dispatchErr: any) => {
      logger.warn('WhatsApp OTP dispatch notice', { phone: cleanPhone, error: dispatchErr.message });
    });

    return {
      ticket,
      destination: cleanPhone,
      demoOtp: otpCode,
    };
  }

  /**
   * Verify customer OTP and issue signed JWT token
   */
  public async verifyCustomerPhoneOtp(
    ticket: string,
    otpCode: string
  ): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; token: string }> {
    const res = await Database.query(
      `SELECT c.id as challenge_id, c.user_id, u.full_name, u.email, u.phone, u.role
       FROM mfa_challenges c
       JOIN users u ON c.user_id = u.id
       WHERE c.ticket = $1
         AND c.expires_at > NOW()
         AND c.verified = FALSE
       LIMIT 1`,
      [ticket.trim()]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid or expired OTP session. Please request a new code.');
    }

    const row = res.rows[0];
    const challengeRes = await Database.query(
      `SELECT otp_code FROM mfa_challenges WHERE id = $1`,
      [row.challenge_id]
    );

    const actualOtp = challengeRes.rows[0]?.otp_code;
    const cleanCode = otpCode.trim();
    if (cleanCode !== actualOtp) {
      throw new Error('Incorrect OTP code. Please enter the 6-digit code sent to your phone.');
    }

    await Database.query(`UPDATE mfa_challenges SET verified = TRUE WHERE id = $1`, [row.challenge_id]);

    const userPayload: Omit<UserClaims, 'iat' | 'exp'> = {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
    };

    const token = this.signToken(userPayload, 30 * 24 * 3600); // 30-day token
    logger.info('Customer phone login successful', { userId: row.user_id, phone: row.phone });

    return {
      user: userPayload,
      token,
    };
  }

  /**
   * Setup or assign Shopkeeper credentials
   */
  public async setupShopkeeper(params: {
    email: string;
    password?: string;
    fullName?: string;
  }): Promise<{ user: Omit<UserClaims, 'iat' | 'exp'>; created: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName ? params.fullName.trim() : 'Store Shopkeeper';
    const cleanPassword = params.password || 'Shopkeeper@2026';
    const passwordHash = this.hashPassword(cleanPassword);

    const existing = await Database.query(
      `SELECT id, full_name, email, phone, role FROM users WHERE lower(email) = $1 LIMIT 1`,
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      await Database.query(
        `UPDATE users
         SET role = 'STORE_ADMIN', password_hash = $1, full_name = $2, is_active = TRUE
         WHERE id = $3`,
        [passwordHash, cleanName, user.id]
      );
      return {
        user: {
          userId: user.id,
          fullName: cleanName,
          email: cleanEmail,
          phone: user.phone,
          role: 'STORE_ADMIN',
        },
        created: false,
      };
    } else {
      const userId = crypto.randomUUID();
      await Database.query(
        `INSERT INTO users (id, full_name, email, password_hash, role, is_active, mfa_enabled)
         VALUES ($1, $2, $3, $4, 'STORE_ADMIN', TRUE, FALSE)`,
        [userId, cleanName, cleanEmail, passwordHash]
      );
      return {
        user: {
          userId,
          fullName: cleanName,
          email: cleanEmail,
          role: 'STORE_ADMIN',
        },
        created: true,
      };
    }
  }
}

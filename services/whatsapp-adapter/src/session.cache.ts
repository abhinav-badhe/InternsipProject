import Redis from 'ioredis';
import { createLogger } from '@grocery/observability';
import type { WhatsAppSessionState } from '@grocery/contracts';

const logger = createLogger('whatsapp-adapter:session-cache');

/**
 * High-performance Redis session cache for active WhatsApp conversations.
 * Stores ephemeral cart items and wizard state with sliding TTL.
 * Automatically falls back gracefully when Redis is unconfigured or unreachable.
 */
export class SessionCache {
  private redis: any = null;
  private isAvailable = false;
  private defaultTtl = 86400; // 24 hours sliding TTL

  constructor(redisUrl?: string, customClient?: any) {
    if (customClient) {
      this.redis = customClient;
      this.isAvailable = true;
      return;
    }

    const url = redisUrl || process.env.REDIS_URL;
    if (url) {
      try {
        const client = new (Redis as any)(url, {
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 3) return null;
            return Math.min(times * 100, 1000);
          },
        });

        client.on('connect', () => {
          this.isAvailable = true;
          logger.info('Connected to Redis for WhatsApp conversational session caching');
        });

        client.on('error', (err: any) => {
          this.isAvailable = false;
          logger.warn('Redis session cache error, falling back to PostgreSQL', { error: err.message });
        });

        client.connect().catch((err: any) => {
          this.isAvailable = false;
          logger.warn('Could not establish initial Redis connection for session cache', { error: err.message });
        });

        this.redis = client;
      } catch (err: any) {
        this.isAvailable = false;
        logger.warn('Failed to initialize Redis session cache', { error: err.message });
      }
    }
  }

  private getKey(phone: string): string {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const clean10 = cleanDigits.slice(-10);
    return `wa:session:${clean10}`;
  }

  public async getSession(phone: string): Promise<WhatsAppSessionState | null> {
    if (!this.isAvailable || !this.redis) return null;

    try {
      const data = await this.redis.get(this.getKey(phone));
      if (!data) return null;
      return JSON.parse(data) as WhatsAppSessionState;
    } catch (err: any) {
      logger.warn('Redis error reading session, falling back to DB', { error: err.message });
      return null;
    }
  }

  public async saveSession(session: WhatsAppSessionState, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable || !this.redis || !session.phoneNumber) return;

    try {
      const key = this.getKey(session.phoneNumber);
      const ttl = ttlSeconds || this.defaultTtl;
      await this.redis.set(key, JSON.stringify(session), 'EX', ttl);
    } catch (err: any) {
      logger.warn('Redis error saving session', { error: err.message });
    }
  }

  public async deleteSession(phone: string): Promise<void> {
    if (!this.isAvailable || !this.redis) return;

    try {
      await this.redis.del(this.getKey(phone));
    } catch (err: any) {
      logger.warn('Redis error deleting session', { error: err.message });
    }
  }

  public isConnected(): boolean {
    return this.isAvailable;
  }
}

export const sessionCache = new SessionCache();

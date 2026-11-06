import Redis from 'ioredis';
import { createLogger } from '@grocery/observability';

const logger = createLogger('catalog-service:cache');

interface CacheEntry {
  data: any;
  expiresAt: number;
}

export class CatalogCache {
  private redis: any = null;
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly defaultTtl: number;

  constructor(options?: { redisUrl?: string; defaultTtlSeconds?: number }) {
    this.defaultTtl = options?.defaultTtlSeconds || 60; // 60 seconds TTL for hot catalog browsing
    const url = options?.redisUrl || process.env.REDIS_URL;

    if (url) {
      try {
        this.redis = new (Redis as any)(url, {
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          lazyConnect: true,
        });
        this.redis.on('connect', () => {
          logger.info('Connected to Redis for Catalog Cache-Aside layer');
        });
        this.redis.on('error', (err: any) => {
          logger.warn('Redis catalog cache warning, using in-memory store', { error: err.message });
        });
      } catch {
        this.redis = null;
      }
    }

    // Periodic sweep of memory cache
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt < now) {
          this.memoryCache.delete(key);
        }
      }
    }, 30000);
    if (interval.unref) interval.unref();
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis) {
        const raw = await this.redis.get(`freshcart:cat:${key}`);
        if (raw) return JSON.parse(raw) as T;
      }

      const mem = this.memoryCache.get(key);
      if (mem && mem.expiresAt > Date.now()) {
        return mem.data as T;
      }
      return null;
    } catch {
      return null;
    }
  }

  public async set(key: string, data: any, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTtl;
    try {
      if (this.redis) {
        await this.redis.set(`freshcart:cat:${key}`, JSON.stringify(data), 'EX', ttl);
      } else {
        this.memoryCache.set(key, {
          data,
          expiresAt: Date.now() + ttl * 1000,
        });
      }
    } catch (err: any) {
      logger.warn('Catalog cache set error', { key, error: err.message });
    }
  }

  public async invalidateAll(): Promise<void> {
    logger.info('Invalidating catalog cache due to product or batch update');
    try {
      this.memoryCache.clear();
      if (this.redis) {
        const keys = await this.redis.keys('freshcart:cat:*');
        if (keys && keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (err: any) {
      logger.warn('Catalog cache invalidation warning', { error: err.message });
    }
  }
}

export const catalogCache = new CatalogCache();


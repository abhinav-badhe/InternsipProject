import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@grocery/contracts';
import { getRequestContext, createLogger } from '@grocery/observability';
import Redis from 'ioredis';

const logger = createLogger('api-gateway:idempotency');

interface CachedIdempotencyResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
  createdAt: number;
}

export class IdempotencyMiddleware {
  private redis: any = null;
  private isRedisAvailable = false;
  private readonly inMemoryCache = new Map<string, CachedIdempotencyResponse | 'IN_PROGRESS'>();
  private readonly ttlSeconds: number;

  public getStorageMode(): 'DISTRIBUTED_REDIS' | 'IN_MEMORY' {
    return this.redis && this.isRedisAvailable ? 'DISTRIBUTED_REDIS' : 'IN_MEMORY';
  }

  constructor(options?: { redisUrl?: string; customRedis?: any; ttlSeconds?: number }) {
    this.ttlSeconds = options?.ttlSeconds || 86400; // 24 hours retention

    if (options?.customRedis) {
      this.redis = options.customRedis;
      this.isRedisAvailable = true;
    } else {
      const url = options?.redisUrl || process.env.REDIS_URL;
      if (url) {
        try {
          const isTls = url.startsWith('rediss://');
          const client = new (Redis as any)(url, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            lazyConnect: true,
            tls: isTls ? { rejectUnauthorized: false } : undefined,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 100, 1000);
            },
          });

          client.on('connect', () => {
            this.isRedisAvailable = true;
            logger.info('Connected to Redis for distributed idempotency cache');
          });

          client.on('error', (err: any) => {
            this.isRedisAvailable = false;
            logger.warn('Redis idempotency connection warning, using in-memory store', { error: err.message });
          });

          client.connect().catch((err: any) => {
            this.isRedisAvailable = false;
            logger.warn('Could not establish initial Redis idempotency connection, using in-memory fallback', { error: err.message });
          });

          this.redis = client;
        } catch {
          this.redis = null;
          this.isRedisAvailable = false;
        }
      }
    }

    // Background cleanup of in-memory cache every 60 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.ttlSeconds * 1000;
      for (const [key, val] of this.inMemoryCache.entries()) {
        if (val !== 'IN_PROGRESS' && val.createdAt < cutoff) {
          this.inMemoryCache.delete(key);
        }
      }
    }, 60000);
    if (interval.unref) interval.unref();
  }

  public middleware = async (req: Request, res: Response, next: NextFunction) => {
    // Only apply idempotency to mutating HTTP operations
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = (
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body?.idempotencyKey
    ) as string | undefined;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return next();
    }

    const cleanKey = idempotencyKey.trim();
    const userId = (req as any).user?.userId || req.headers['x-user-id'] || 'anon';
    const cacheKey = `freshcart:idemp:${userId}:${cleanKey}`;
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    try {
      // If distributed cache is strictly required (e.g. multi-instance clusters), block mutations to prevent split-brain duplicates
      if (process.env.REQUIRE_DISTRIBUTED_CACHE === 'true' && (!this.redis || !this.isRedisAvailable)) {
        logger.error('Idempotency rejecting mutating request: REQUIRE_DISTRIBUTED_CACHE is active but Redis is unavailable');
        return res.status(503).json(
          errorResponse(
            'DISTRIBUTED_IDEMPOTENCY_UNAVAILABLE',
            'Distributed idempotency protection is required but Redis is unreachable. Mutating operation blocked to prevent split-brain duplicates.',
            correlationId
          )
        );
      }

      // 1. Check existing record
      let cached: any = null;
      if (this.redis) {
        try {
          const raw = await this.redis.get(cacheKey);
          if (raw) cached = JSON.parse(raw);
        } catch {
          cached = this.inMemoryCache.get(cacheKey);
        }
      } else {
        cached = this.inMemoryCache.get(cacheKey);
      }

      if (cached) {
        if (cached === 'IN_PROGRESS' || cached.status === 'IN_PROGRESS') {
          logger.warn('Duplicate request rejected: Request currently in progress', {
            idempotencyKey: cleanKey,
            path: req.path,
          });
          return res.status(409).json(
            errorResponse(
              'CONCURRENT_REQUEST',
              'A request with this Idempotency-Key is currently being processed. Please retry in a few moments.',
              correlationId
            )
          );
        }

        // Return exact cached response
        logger.info('Idempotency cache hit: Returning cached response without duplicate execution', {
          idempotencyKey: cleanKey,
          status: cached.status,
          path: req.path,
        });

        res.setHeader('X-Cache-Lookup', 'IDEMPOTENCY_HIT');
        res.setHeader('X-Idempotency-Key', cleanKey);
        return res.status(cached.status).json(cached.body);
      }

      // 2. Mark as IN_PROGRESS with 120s safety lock
      if (this.redis) {
        try {
          await this.redis.set(cacheKey, JSON.stringify({ status: 'IN_PROGRESS', createdAt: Date.now() }), 'EX', 120);
        } catch {
          this.inMemoryCache.set(cacheKey, 'IN_PROGRESS');
        }
      } else {
        this.inMemoryCache.set(cacheKey, 'IN_PROGRESS');
      }

      // 3. Intercept response to capture final status and body
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        const statusCode = res.statusCode || 200;
        const entry: CachedIdempotencyResponse = {
          status: statusCode,
          body,
          createdAt: Date.now(),
        };

        // Cache successful and client-side safe outcomes
        if (statusCode < 500) {
          if (this.redis) {
            this.redis
              .set(cacheKey, JSON.stringify(entry), 'EX', this.ttlSeconds)
              .catch(() => {
                this.inMemoryCache.set(cacheKey, entry);
              });
          } else {
            this.inMemoryCache.set(cacheKey, entry);
          }
        } else {
          // If server crashed with 500+, release lock so client can retry
          if (this.redis) {
            this.redis.del(cacheKey).catch(() => {});
          } else {
            this.inMemoryCache.delete(cacheKey);
          }
        }

        res.setHeader('X-Idempotency-Key', cleanKey);
        return originalJson(body);
      };

      next();
    } catch (err: any) {
      logger.error('Error in idempotency middleware', { error: err.message });
      next();
    }
  };
}


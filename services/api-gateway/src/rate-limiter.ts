import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@grocery/contracts';
import { getRequestContext, createLogger } from '@grocery/observability';
import Redis from 'ioredis';

const logger = createLogger('api-gateway:rate-limiter');

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly store = new Map<string, RateLimitRecord>();

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodic cleanup of expired entries
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (record.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 30000);

    // Unref so timer doesn't keep node process alive in tests
    if (timer.unref) timer.unref();
  }

  public middleware = (req: Request, res: Response, next: NextFunction) => {
    const key = (req.user?.userId || req.ip || req.socket.remoteAddress || 'anonymous').toString();
    const now = Date.now();
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    let record = this.store.get(key);
    if (!record || record.resetAt <= now) {
      record = {
        count: 0,
        resetAt: now + this.windowMs,
      };
      this.store.set(key, record);
    }

    record.count += 1;
    const remaining = Math.max(0, this.maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

    if (record.count > this.maxRequests) {
      return res
        .status(429)
        .json(
          errorResponse(
            'RATE_LIMIT_EXCEEDED',
            `Too many requests. Limit is ${this.maxRequests} per minute. Retry in ${resetSeconds}s.`,
            correlationId
          )
        );
    }

    next();
  };

  public reset(): void {
    this.store.clear();
  }
}

export interface DistributedRateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  redisUrl?: string;
  redisClient?: any;
}

/**
 * Distributed Rate Limiter with Redis support and automated in-memory fallback.
 * Uses atomic fixed-window increments with TTL expiration.
 */
export class DistributedRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly memoryFallback: InMemoryRateLimiter;
  private redis: any = null;
  private isRedisAvailable = false;

  constructor(options?: DistributedRateLimiterOptions) {
    this.windowMs = options?.windowMs || 60000;
    this.maxRequests = options?.maxRequests || 100;
    this.memoryFallback = new InMemoryRateLimiter(this.windowMs, this.maxRequests);

    const redisUrl = options?.redisUrl || process.env.REDIS_URL;
    if (options?.redisClient) {
      this.redis = options.redisClient;
      this.isRedisAvailable = true;
    } else if (redisUrl) {
      try {
        const isTls = redisUrl.startsWith('rediss://');
        const client = new (Redis as any)(redisUrl, {
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
          logger.info('Connected to Redis for distributed rate limiting');
        });

        client.on('error', (err: any) => {
          this.isRedisAvailable = false;
          logger.warn('Redis rate limiter error, using memory fallback', { error: err.message });
        });

        client.connect().catch((err: any) => {
          this.isRedisAvailable = false;
          logger.warn('Could not establish initial Redis connection, using memory fallback', { error: err.message });
        });

        this.redis = client;
      } catch (err: any) {
        this.isRedisAvailable = false;
        logger.warn('Failed to initialize Redis client, using memory fallback', { error: err.message });
      }
    }
  }

  public getStorageMode(): 'DISTRIBUTED_REDIS' | 'IN_MEMORY' {
    return this.isRedisAvailable && this.redis ? 'DISTRIBUTED_REDIS' : 'IN_MEMORY';
  }

  public middleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.isRedisAvailable || !this.redis) {
      if (process.env.REQUIRE_DISTRIBUTED_CACHE === 'true') {
        const correlationId = getRequestContext()?.correlationId || 'unknown';
        logger.error('Rate limiter rejecting request: REQUIRE_DISTRIBUTED_CACHE is active but Redis is unavailable');
        return res
          .status(503)
          .json(
            errorResponse(
              'DISTRIBUTED_CACHE_UNAVAILABLE',
              'Distributed rate limiter is required but Redis is currently unreachable.',
              correlationId
            )
          );
      }
      return this.memoryFallback.middleware(req, res, next);
    }

    const key = `ratelimit:${(req.user?.userId || req.ip || req.socket.remoteAddress || 'anonymous').toString()}`;
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    try {
      const windowSeconds = Math.ceil(this.windowMs / 1000);
      const multi = this.redis.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();

      if (!results || !Array.isArray(results)) {
        return this.memoryFallback.middleware(req, res, next);
      }

      const count = Number(results[0][1]);
      const ttl = Number(results[1][1]);

      // If key has no TTL (first increment), set expiry
      if (ttl === -1) {
        await this.redis.expire(key, windowSeconds);
      }

      const resetSeconds = ttl > 0 ? ttl : windowSeconds;
      const remaining = Math.max(0, this.maxRequests - count);

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

      if (count > this.maxRequests) {
        return res
          .status(429)
          .json(
            errorResponse(
              'RATE_LIMIT_EXCEEDED',
              `Too many requests. Limit is ${this.maxRequests} per minute. Retry in ${resetSeconds}s.`,
              correlationId
            )
          );
      }

      next();
    } catch (err: any) {
      logger.warn('Redis execution error during rate check, falling back to memory', { error: err.message });
      if (process.env.REQUIRE_DISTRIBUTED_CACHE === 'true') {
        return res
          .status(503)
          .json(
            errorResponse(
              'DISTRIBUTED_CACHE_ERROR',
              'Distributed rate limit operation failed on Redis cluster.',
              correlationId
            )
          );
      }
      return this.memoryFallback.middleware(req, res, next);
    }
  };

  public reset(): void {
    this.memoryFallback.reset();
  }
}

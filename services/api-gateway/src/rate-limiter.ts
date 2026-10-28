import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '@grocery/contracts';
import { getRequestContext } from '@grocery/observability';

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

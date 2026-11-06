import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export interface RequestContext {
  correlationId: string;
  serviceName: string;
  userId?: string;
  route?: string;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return contextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return contextStorage.getStore();
}

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACT_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cardnumber',
  'cvv',
  'accesstoken',
  'refreshtoken',
  'apikey',
]);

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = redactObject(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export class Logger {
  constructor(private readonly serviceName: string) {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const ctx = getRequestContext();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: ctx?.serviceName || this.serviceName,
      correlationId: ctx?.correlationId || 'none',
      message,
      ...(meta ? (redactObject(meta) as Record<string, unknown>) : {}),
    };

    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }
}

export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

export * from './circuit-breaker.js';

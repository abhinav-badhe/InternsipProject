import { Logger } from './index.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // consecutive failures before tripping (default: 5)
  resetTimeoutMs?: number;   // cool-off period before testing recovery (default: 10000ms)
  timeoutMs?: number;        // action timeout in ms (default: 8000ms)
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN. Fast-failing downstream request to prevent thread pool exhaustion.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly timeoutMs: number;
  private readonly logger: Logger;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private nextAttemptAt = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 10000;
    this.timeoutMs = options.timeoutMs || 8000;
    this.logger = new Logger(`circuit-breaker:${options.name}`);
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      this.logger.info(`Circuit '${this.name}' transitioned from OPEN to HALF_OPEN (trial probe enabled)`);
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      // Execute with timeout
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.logger.info(`Circuit '${this.name}' successfully recovered and returned to CLOSED state`);
    }
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(err: any): void {
    this.consecutiveFailures++;
    this.logger.warn(`Failure detected in '${this.name}' (${this.consecutiveFailures}/${this.failureThreshold})`, {
      error: err.message,
    });

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      this.logger.error(`Circuit '${this.name}' TRIPPED to OPEN. Blocking downstream calls for ${this.resetTimeoutMs}ms`);
    }
  }
}


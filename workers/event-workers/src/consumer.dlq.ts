import { createLogger } from '@grocery/observability';

const logger = createLogger('workers:event-consumer');

export interface DeadLetterEvent {
  id: string;
  originalEventId: string;
  eventType: string;
  consumerName: string;
  payload: any;
  retryAttempts: number;
  lastErrorMessage: string;
  failedAt: Date;
}

export class SafeEventConsumer {
  private consumerName: string;
  private maxRetries: number;
  private dlqStorage: DeadLetterEvent[] = [];
  private queryDb?: (sql: string, params?: any[]) => Promise<any>;

  constructor(
    consumerName: string,
    maxRetries = 3,
    queryDb?: (sql: string, params?: any[]) => Promise<any>
  ) {
    this.consumerName = consumerName;
    this.maxRetries = maxRetries;
    this.queryDb = queryDb;
  }

  /**
   * Acceptance Scenario 12:
   * Safe consumer execution with bounded retries and automatic routing to DLQ on exhaustion.
   */
  public async handleMessage(
    event: { eventId: string; eventType: string; data: any },
    processor: (data: any) => Promise<void>
  ): Promise<{ status: 'PROCESSED' | 'DEAD_LETTERED'; attempts: number }> {
    let attempts = 0;
    let lastError: any = null;

    while (attempts < this.maxRetries) {
      attempts++;
      try {
        await processor(event.data);
        logger.info('Event successfully processed by consumer', {
          eventId: event.eventId,
          consumer: this.consumerName,
          attempts,
        });
        return { status: 'PROCESSED', attempts };
      } catch (err: any) {
        lastError = err;
        logger.warn('Event processing failed, retrying...', {
          eventId: event.eventId,
          attempt: attempts,
          maxRetries: this.maxRetries,
          error: err.message,
        });
      }
    }

    // Exhausted retries -> Route to Dead-Letter Queue (DLQ)
    const dlqEntry: DeadLetterEvent = {
      id: `dlq-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      originalEventId: event.eventId,
      eventType: event.eventType,
      consumerName: this.consumerName,
      payload: event.data,
      retryAttempts: attempts,
      lastErrorMessage: lastError?.message || 'Unknown consumer error',
      failedAt: new Date(),
    };

    this.dlqStorage.push(dlqEntry);

    if (this.queryDb) {
      await this.queryDb(
        `INSERT INTO dead_letter_events (id, original_event_id, event_type, consumer_name, payload, retry_attempts, error_message, failed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          dlqEntry.id,
          dlqEntry.originalEventId,
          dlqEntry.eventType,
          dlqEntry.consumerName,
          JSON.stringify(dlqEntry.payload),
          dlqEntry.retryAttempts,
          dlqEntry.lastErrorMessage,
        ]
      );
    }

    logger.error('Consumer retries exhausted; message routed to Dead-Letter Queue', {
      dlqId: dlqEntry.id,
      originalEventId: event.eventId,
      attempts,
      error: dlqEntry.lastErrorMessage,
    });

    return { status: 'DEAD_LETTERED', attempts };
  }

  public getDlqEntries(): DeadLetterEvent[] {
    return [...this.dlqStorage];
  }
}

import { createLogger } from '@grocery/observability';

const logger = createLogger('workers:outbox-publisher');

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  createdAt: Date;
  publishedAt?: Date;
}

export interface MessageBrokerClient {
  publish(topic: string, message: any): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export class OutboxPublisher {
  private isRunning = false;
  private broker: MessageBrokerClient;
  private queryDb: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>;

  constructor(
    broker: MessageBrokerClient,
    queryDb: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>
  ) {
    this.broker = broker;
    this.queryDb = queryDb;
  }

  /**
   * Acceptance Scenario 11:
   * During broker outage, events are never lost and remain safe in PostgreSQL outbox.
   * Once broker recovers, publication safely resumes in order.
   */
  public async processPendingOutboxBatch(batchSize = 50): Promise<{ publishedCount: number; failedCount: number }> {
    // 1. Fetch pending outbox records
    const res = await this.queryDb(
      `SELECT id, aggregate_type, aggregate_id, event_type, payload, status, retry_count, created_at
       FROM outbox_events
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT $1`,
      [batchSize]
    );

    const events: OutboxEvent[] = res.rows;
    let publishedCount = 0;
    let failedCount = 0;

    for (const rawEvt of events as any[]) {
      const id = rawEvt.id;
      const aggregateType = (rawEvt.aggregate_type || rawEvt.aggregateType || 'default').toString();
      const eventType = rawEvt.event_type || rawEvt.eventType;
      const aggregateId = rawEvt.aggregate_id || rawEvt.aggregateId;
      const payload = rawEvt.payload;

      try {
        // Attempt publication to message broker (e.g. RabbitMQ exchange)
        await this.broker.publish(`domain.${aggregateType.toLowerCase()}`, {
          eventId: id,
          eventType,
          aggregateId,
          data: payload,
          timestamp: new Date().toISOString(),
        });

        // Mark published in transactional database
        await this.queryDb(
          `UPDATE outbox_events
           SET status = 'PUBLISHED', published_at = NOW()
           WHERE id = $1`,
          [id]
        );

        publishedCount++;
        logger.info('Outbox event published to broker', { eventId: id, eventType });
      } catch (err: any) {
        failedCount++;
        logger.warn('Broker publication failed; event retained in outbox for retry', {
          eventId: id,
          error: err.message,
        });

        await this.queryDb(
          `UPDATE outbox_events
           SET retry_count = retry_count + 1
           WHERE id = $1`,
          [id]
        );

        // Break on broker outage to preserve strict causal event ordering
        break;
      }
    }

    return { publishedCount, failedCount };
  }
}

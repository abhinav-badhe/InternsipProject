import { Pool } from 'pg';
import { OutboxPublisher, MessageBrokerClient } from './outbox.publisher.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('workers:daemon');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  'postgresql://postgres@127.0.0.1:5432/freshcart';

const isRemote =
  connectionString.includes('supabase.co') ||
  connectionString.includes('supabase.com') ||
  process.env.DB_SSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30000,
});

// Auto-bootstrap dead_letter_events table
pool.query(`
  CREATE TABLE IF NOT EXISTS dead_letter_events (
    id VARCHAR(64) PRIMARY KEY,
    original_event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    consumer_name VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    retry_attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    failed_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_dlq_failed_at ON dead_letter_events(failed_at);
`).catch(() => {});

// In-process broker dispatcher (for local / render workers)
const broker: MessageBrokerClient = {
  publish: async (topic: string, message: any) => {
    logger.info(`[BROKER] Dispatched domain event to topic: ${topic}`, {
      eventId: message.id || message.eventId,
      eventType: message.eventType || message.event_type,
    });
  },
  isHealthy: async () => true,
};

const queryDb = async (sql: string, params?: any[]) => {
  const res = await pool.query(sql, params);
  return { rows: res.rows, rowCount: res.rowCount || 0 };
};

const publisher = new OutboxPublisher(broker, queryDb);

let isRunning = true;
let tickCount = 0;

async function runWorkerLoop() {
  logger.info('Transactional Outbox Publisher Worker started. Polling outbox_events...');

  while (isRunning) {
    try {
      const outcome = await publisher.processPendingOutboxBatch(25);
      if (outcome.publishedCount > 0) {
        logger.info(`Successfully processed ${outcome.publishedCount} outbox events`, outcome);
      }
    } catch (err: any) {
      logger.error('Error during outbox publisher tick', { error: err.message });
    }

    // Periodic sweep for expired inventory reservations every ~3 minutes (60 ticks * 3s)
    tickCount++;
    if (tickCount % 60 === 0) {
      try {
        const invUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
        fetch(`${invUrl}/api/v1/inventory/cleanup-expired`, { method: 'POST' })
          .then(async (r) => {
            if (r.ok) {
              const resJson: any = await r.json();
              const released = resJson?.data?.cleanedCount ?? resJson?.data?.releasedCount ?? 0;
              if (released > 0) {
                logger.info(`Cleaned up ${released} expired stock reservations`);
              }
            }
          })
          .catch(() => {});
      } catch {}
    }

    // Poll every 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  await pool.end();
  logger.info('Outbox Publisher Worker gracefully stopped.');
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down worker...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down worker...');
  isRunning = false;
});

runWorkerLoop().catch((err) => {
  logger.error('Fatal Outbox Worker failure', { error: err.message });
  process.exit(1);
});


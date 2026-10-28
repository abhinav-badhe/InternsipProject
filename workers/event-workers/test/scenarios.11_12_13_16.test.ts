import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxPublisher, MessageBrokerClient } from '../src/outbox.publisher.js';
import { SafeEventConsumer } from '../src/consumer.dlq.js';
import { MigrationGate } from '../src/migration.gate.js';
import { DisasterRecoveryDrillRunner, BackupSnapshot } from '../src/dr.drill.js';

describe('Workers & Resilience - Acceptance Scenarios 11, 12, 13, 16', () => {

  // -------------------------------------------------------------
  // Scenario 11: Message Broker Outbox Recovery
  // -------------------------------------------------------------
  it('Scenario 11: Broker outage retains outbox events safely in PostgreSQL; publication resumes upon recovery', async () => {
    let brokerIsOnline = false;
    const brokerPublishedMessages: any[] = [];

    const mockBroker: MessageBrokerClient = {
      publish: async (_topic: string, message: any) => {
        if (!brokerIsOnline) {
          throw new Error('ECONNREFUSED: RabbitMQ / Message broker is unreachable (Outage simulation)');
        }
        brokerPublishedMessages.push(message);
      },
      isHealthy: async () => brokerIsOnline,
    };

    // Simulated PostgreSQL outbox table
    const outboxEventsTable = [
      {
        id: 'evt-001',
        aggregate_type: 'Order',
        aggregate_id: 'ord-101',
        event_type: 'order.confirmed',
        payload: { orderNumber: 'ORD-101', total: 450.0 },
        status: 'PENDING',
        retry_count: 0,
        created_at: new Date('2026-10-28T10:00:00Z'),
      },
      {
        id: 'evt-002',
        aggregate_type: 'Inventory',
        aggregate_id: 'res-202',
        event_type: 'inventory.reserved',
        payload: { sku: 'DETTOL-75G', quantity: 2 },
        status: 'PENDING',
        retry_count: 0,
        created_at: new Date('2026-10-28T10:00:01Z'),
      },
    ];

    const mockDbQuery = async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT') && sql.includes('outbox_events')) {
        const pending = outboxEventsTable.filter((e) => e.status === 'PENDING');
        return { rows: pending, rowCount: pending.length };
      }
      if (sql.includes('UPDATE outbox_events') && sql.includes("status = 'PUBLISHED'")) {
        const id = params?.[0];
        const record = outboxEventsTable.find((e) => e.id === id);
        if (record) {
          record.status = 'PUBLISHED';
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE outbox_events') && sql.includes('retry_count = retry_count + 1')) {
        const id = params?.[0];
        const record = outboxEventsTable.find((e) => e.id === id);
        if (record) record.retry_count++;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    const publisher = new OutboxPublisher(mockBroker, mockDbQuery);

    // 1. Phase 1: Broker is down (Outage)
    brokerIsOnline = false;
    const outageResult = await publisher.processPendingOutboxBatch(50);

    // Zero messages reached the broken broker
    assert.equal(outageResult.publishedCount, 0);
    assert.equal(outageResult.failedCount, 1);
    assert.equal(brokerPublishedMessages.length, 0);

    // Crucial guarantee: Events were NOT lost; they remain PENDING in PostgreSQL
    assert.equal(outboxEventsTable[0].status, 'PENDING');
    assert.equal(outboxEventsTable[1].status, 'PENDING');
    assert.equal(outboxEventsTable[0].retry_count, 1);

    // 2. Phase 2: Broker recovers
    brokerIsOnline = true;
    const recoveryResult = await publisher.processPendingOutboxBatch(50);

    // Both events published in order
    assert.equal(recoveryResult.publishedCount, 2);
    assert.equal(recoveryResult.failedCount, 0);
    assert.equal(brokerPublishedMessages.length, 2);
    assert.equal(brokerPublishedMessages[0].eventId, 'evt-001');
    assert.equal(brokerPublishedMessages[1].eventId, 'evt-002');

    // Both events updated to PUBLISHED in PostgreSQL
    assert.equal(outboxEventsTable[0].status, 'PUBLISHED');
    assert.equal(outboxEventsTable[1].status, 'PUBLISHED');
  });

  // -------------------------------------------------------------
  // Scenario 12: Dead-Letter Queue (DLQ) Fallback
  // -------------------------------------------------------------
  it('Scenario 12: Consumer retries transient failures and routes to DLQ on retry exhaustion', async () => {
    const consumer = new SafeEventConsumer('order-notification-consumer', 3);

    // Test A: Succeeds on 2nd attempt (transient error)
    let callCountA = 0;
    const resultA = await consumer.handleMessage(
      { eventId: 'evt-succ-1', eventType: 'order.dispatched', data: { orderId: 'ord-1' } },
      async () => {
        callCountA++;
        if (callCountA === 1) throw new Error('Temporary gateway timeout');
        // Succeeds on 2nd attempt
      }
    );

    assert.equal(resultA.status, 'PROCESSED');
    assert.equal(resultA.attempts, 2);

    // Test B: Fails permanently 3 times -> routes to Dead-Letter Queue
    let callCountB = 0;
    const resultB = await consumer.handleMessage(
      { eventId: 'evt-fatal-2', eventType: 'order.dispatched', data: { orderId: 'ord-corrupt' } },
      async () => {
        callCountB++;
        throw new Error('Fatal validation failure: invalid recipient address');
      }
    );

    assert.equal(resultB.status, 'DEAD_LETTERED');
    assert.equal(resultB.attempts, 3);
    assert.equal(callCountB, 3);

    const dlq = consumer.getDlqEntries();
    assert.equal(dlq.length, 1);
    assert.equal(dlq[0].originalEventId, 'evt-fatal-2');
    assert.equal(dlq[0].retryAttempts, 3);
    assert.ok(dlq[0].lastErrorMessage.includes('Fatal validation failure'));
  });

  // -------------------------------------------------------------
  // Scenario 13: Migration Failure Rollback & Gate
  // -------------------------------------------------------------
  it('Scenario 13: Migration failure rolls back transaction and fails readiness checks closed (503)', async () => {
    const gate = new MigrationGate();

    const executedSqlStatements: string[] = [];
    const mockSqlExecutor = async (sql: string) => {
      executedSqlStatements.push(sql);
      if (sql.includes('SYNTAX ERROR TRIGGER')) {
        throw new Error('syntax error at or near "SYNTAX"');
      }
    };

    const migrations = [
      { version: '001', name: 'create_orders', sql: 'CREATE TABLE orders (id UUID);' },
      { version: '002', name: 'broken_migration', sql: 'SYNTAX ERROR TRIGGER;' },
    ];

    const result = await gate.executeMigrations(migrations, mockSqlExecutor);

    // Migration execution failed
    assert.equal(result.success, false);
    assert.equal(result.appliedCount, 1);
    assert.ok(result.error?.includes('broken_migration'));

    // Verified rollback was executed
    assert.ok(executedSqlStatements.includes('ROLLBACK;'));

    // Readiness health check MUST fail closed with 503
    const health = gate.getReadinessStatus();
    assert.equal(health.status, 'not_ready');
    assert.equal(health.statusCode, 503);
    assert.ok(health.error?.includes('broken_migration'));
  });

  // -------------------------------------------------------------
  // Scenario 16: Database Backup Restoration Drill
  // -------------------------------------------------------------
  it('Scenario 16: Backup restoration drill completes within agreed RTO and verifies zero data loss RPO', async () => {
    const runner = new DisasterRecoveryDrillRunner(900, 0); // RTO <= 15 mins (900s), RPO <= 0 lost transactions

    const backupSnapshot: BackupSnapshot = {
      snapshotId: 'snap-2026-10-28-wal-001',
      sourceDatabase: 'supabase-prod-order-service',
      timestamp: new Date('2026-10-28T09:30:00Z'),
      checksum: 'sha256-a1b2c3d4e5f6',
      tables: {
        orders: 1420,
        order_items: 4260,
        order_saga_log: 1420,
      },
      lastCommittedTxId: 98500,
    };

    // Simulate cluster restore executing in 4.5 seconds
    const mockRestoreCluster = async (snapshot: BackupSnapshot) => {
      return {
        restoredTables: { ...snapshot.tables },
        durationSeconds: 4.5,
      };
    };

    const result = await runner.executeRestorationDrill({
      backup: backupSnapshot,
      primaryLastTxId: 98500, // Exact match = 0 lost transactions
      restoreClusterFn: mockRestoreCluster,
    });

    assert.equal(result.success, true);
    assert.equal(result.rtoPassed, true);
    assert.equal(result.restorationDurationSeconds, 4.5);
    assert.ok(result.restorationDurationSeconds <= 900);
    assert.equal(result.rpoPassed, true);
    assert.equal(result.dataLossTransactions, 0);
    assert.equal(result.restoredTables.orders, 1420);
  });
});

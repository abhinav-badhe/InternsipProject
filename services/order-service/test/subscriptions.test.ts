import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextSubscriptionDate, subscriptionClock } from '@grocery/contracts';
import {
  SubscriptionProcessor,
  hashNamespaceTo32BitInt,
  getSubscriptionAdvisoryLockKeys,
} from '../src/subscriptions.js';
import { Database } from '../src/db.js';

describe('Morning subscription automation', () => {
  it('uses India dates and skips weekends while preserving recurring cadence', () => {
    assert.deepEqual(subscriptionClock(new Date('2026-11-05T20:00:00Z')), { date: '2026-11-06', minute: 90 });
    assert.equal(nextSubscriptionDate('2026-11-06', 'WEEKDAYS_ONLY'), '2026-11-09');
    assert.equal(nextSubscriptionDate('2026-11-06', 'ALTERNATE_DAYS'), '2026-11-08');
    assert.equal(nextSubscriptionDate('2026-11-06', 'WEEKLY'), '2026-11-13');
  });

  for (const [name, time, frequency, expectedOrders, next] of [
    ['prepares the chosen window', '2026-11-06T00:45:00Z', 'DAILY', 1, '2026-11-07'], // 06:15 IST
    ['does not prepare too early', '2026-11-05T23:00:00Z', 'DAILY', 0, undefined],
    ['never generates morning milk at noon', '2026-11-06T06:30:00Z', 'DAILY', 0, '2026-11-07'],
    ['does not deliver weekdays-only orders on Saturday', '2026-11-07T01:00:00Z', 'WEEKDAYS_ONLY', 0, '2026-11-09'],
    ['keeps alternate-day recovery on the original cadence', '2026-11-07T01:00:00Z', 'ALTERNATE_DAYS', 0, '2026-11-08'],
  ] as const) {
    it(name, async () => {
      const original = Database.getClient;
      const orders: any[] = []; const updates: any[] = [];
      const sub = { id: 'sub-1', subscription_number: 'SUB-1', customer_id: 'phone_919000000001', sku: 'MILK', quantity: 1,
        frequency, delivery_slot: '07:00 AM - 09:00 AM', due_date: '2026-11-06', channel: 'WHATSAPP',
        delivery_address: { addressLine1: '4 Main Road', city: 'Bengaluru', postalCode: '560102', phone: '+919000000001' } };
      Database.getClient = async () => ({ release() {}, async query(sql: string, params?: any[]) {
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: true }] };
        if (sql.includes('SELECT *, next_delivery_date')) return { rows: [sub] };
        if (sql.includes('SELECT status')) return { rows: [{ status: 'ACTIVE' }] };
        if (sql.startsWith('UPDATE')) updates.push(params);
        return { rows: [] };
      } } as any);
      try {
        const processor = new SubscriptionProcessor(async (request) => { orders.push(request); return { orderId: 'order-1', orderNumber: 'ORD-1', status: 'CONFIRMED' } as any; });
        await processor.run(new Date(time));
        assert.equal(orders.length, expectedOrders);
        if (next) assert.equal(updates[0][0], next); else assert.equal(updates.length, 0);
        if (orders.length) {
          assert.equal(orders[0].paymentMethod, 'COD');
          assert.equal(orders[0].idempotencyKey, 'subscription:sub-1:2026-11-06');
          assert.equal(orders[0].deliveryAddress.deliveryWindowStart, '2026-11-06T07:00:00+05:30');
          assert.equal(orders[0].deliveryAddress.slot, sub.delivery_slot);
        }
      } finally { Database.getClient = original; }
    });
  }

  it('skips overlapping runners and preserves due dates when checkout fails', async () => {
    const original = Database.getClient; let available = false; let checkoutCalls = 0; let updates = 0;
    Database.getClient = async () => ({ release() {}, async query(sql: string) {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: available }] };
      if (sql.includes('SELECT *, next_delivery_date')) return { rows: [{ id: 's', subscription_number: 'SUB-X', frequency: 'DAILY', due_date: '2026-11-06', delivery_slot: '07:00 AM - 09:00 AM', delivery_address: {} }] };
      if (sql.includes('SELECT status')) return { rows: [{ status: 'ACTIVE' }] };
      if (sql.startsWith('UPDATE')) updates++;
      return { rows: [] };
    } } as any);
    try {
      const processor = new SubscriptionProcessor(async () => { checkoutCalls++; throw new Error('INSUFFICIENT_STOCK'); });
      const busy = await processor.run(new Date('2026-11-06T01:00:00Z'));
      assert.equal((busy as any).busy, true); assert.equal(checkoutCalls, 0);
      available = true;
      const failed = await processor.run(new Date('2026-11-06T01:00:00Z'));
      assert.equal(failed.errors.length, 1); assert.equal(updates, 0);
    } finally { Database.getClient = original; }
  });

  it('DAT-03 Fix: derives namespaced 32-bit keys and invokes pg_try_advisory_lock($1, $2) to prevent collisions', async () => {
    // 1. Verify hash generates valid signed 32-bit integer within PostgreSQL int4 bounds
    const key1 = hashNamespaceTo32BitInt('freshcart:order-service');
    const key2 = hashNamespaceTo32BitInt('morning-subscription-processor');
    assert.ok(Number.isInteger(key1));
    assert.ok(Number.isInteger(key2));
    assert.ok(key1 >= -2147483648 && key1 <= 2147483647, 'key1 must fit within signed 32-bit int');
    assert.ok(key2 >= -2147483648 && key2 <= 2147483647, 'key2 must fit within signed 32-bit int');
    assert.notEqual(key1, key2, 'Distinct namespaces must produce distinct keys');

    // 2. Different application namespaces must never collide
    const tenantAKey = hashNamespaceTo32BitInt('tenant-a:order-service');
    const tenantBKey = hashNamespaceTo32BitInt('tenant-b:order-service');
    assert.notEqual(tenantAKey, tenantBKey);

    // 3. SubscriptionProcessor must pass namespaced arguments to pg_try_advisory_lock and pg_advisory_unlock
    const original = Database.getClient;
    const lockCalls: { sql: string; params?: any[] }[] = [];
    const unlockCalls: { sql: string; params?: any[] }[] = [];

    Database.getClient = async () => ({
      release() {},
      async query(sql: string, params?: any[]) {
        if (sql.includes('pg_try_advisory_lock')) {
          lockCalls.push({ sql, params });
          return { rows: [{ locked: true }] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          unlockCalls.push({ sql, params });
          return { rows: [] };
        }
        if (sql.includes('SELECT *, next_delivery_date')) return { rows: [] };
        return { rows: [] };
      },
    } as any);

    try {
      const processor = new SubscriptionProcessor(async () => ({} as any));
      await processor.run(new Date('2026-11-06T01:00:00Z'));

      assert.equal(lockCalls.length, 1);
      assert.match(lockCalls[0].sql, /pg_try_advisory_lock\(\$1, \$2\)/);
      const [expectedK1, expectedK2] = getSubscriptionAdvisoryLockKeys();
      assert.deepEqual(lockCalls[0].params, [expectedK1, expectedK2]);

      assert.equal(unlockCalls.length, 1);
      assert.match(unlockCalls[0].sql, /pg_advisory_unlock\(\$1, \$2\)/);
      assert.deepEqual(unlockCalls[0].params, [expectedK1, expectedK2]);
    } finally {
      Database.getClient = original;
    }
  });
});

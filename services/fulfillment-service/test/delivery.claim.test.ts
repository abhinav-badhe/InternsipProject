import { it } from 'node:test';
import assert from 'node:assert/strict';
import { claimDelivery, DeliveryClaimError } from '../src/delivery.claim.js';
import { Database } from '../src/db.js';

function lockQueue() {
  let tail = Promise.resolve();
  return async () => {
    const previous = tail;
    let unlock!: () => void;
    tail = new Promise<void>((resolve) => { unlock = resolve; });
    await previous;
    return unlock;
  };
}

it('two riders race for one packed order: first lock holder wins and loser receives 409', async () => {
  const original = Database.getClient;
  const lockOrder = lockQueue();
  let assignment: any; let insertions = 0;
  const order = { id: 'order-1', order_number: 'ORD-1', status: 'PACKED', ready_for_pickup: true, delivery_address: {} };
  const riders: Record<string, any> = { a: { id: 'a', full_name: 'Rider A', phone: '1', status: 'ONLINE' }, b: { id: 'b', full_name: 'Rider B', phone: '2', status: 'ONLINE' } };
  Database.getClient = async () => {
    let unlock: (() => void) | undefined;
    return { release() { unlock?.(); }, async query(sql: string, params?: any[]) {
      if (sql.includes('FROM orders') && sql.includes('FOR UPDATE')) { unlock = await lockOrder(); return { rows: [order] }; }
      if (sql.includes('FROM delivery_assignments')) return { rows: assignment ? [assignment] : [] };
      if (sql.includes('FROM delivery_riders')) return { rows: [riders[params![0]]] };
      if (sql.includes('INSERT INTO delivery_assignments')) { insertions++; assignment = { id: params![0], rider: params![3] }; }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') { unlock?.(); unlock = undefined; }
      return { rows: [] };
    } } as any;
  };
  try {
    const results = await Promise.allSettled([claimDelivery('ORD-1', 'a'), claimDelivery('ORD-1', 'b')]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    const error = (results[1] as PromiseRejectedResult).reason as DeliveryClaimError;
    assert.equal(error.status, 409); assert.equal(error.code, 'ORDER_ALREADY_ACCEPTED');
    assert.equal(insertions, 1); assert.equal(assignment.rider, 'a');
  } finally { Database.getClient = original; }
});

for (const [name, patch, expected] of [
  ['unpaid order', { status: 'AWAITING_PAYMENT' }, 'ORDER_NOT_READY'],
  ['unpacked order', { status: 'CONFIRMED' }, 'ORDER_NOT_READY'],
  ['cancelled order', { status: 'CANCELLED' }, 'ORDER_NOT_READY'],
  ['not ready for pickup', { ready_for_pickup: false }, 'ORDER_NOT_READY'],
  ['future subscription window', { delivery_address: { deliveryWindowStart: '2026-11-07T07:00:00+05:30' } }, 'DELIVERY_NOT_DUE'],
  ['expired subscription window', { delivery_address: { deliveryWindowEnd: '2026-11-06T08:00:00+05:30' } }, 'DELIVERY_WINDOW_MISSED'],
] as const) {
  it(`does not assign an ${name}`, async () => {
    const original = Database.getClient; let inserted = false;
    Database.getClient = async () => ({ release() {}, async query(sql: string) {
      if (sql.includes('FROM orders')) return { rows: [Object.assign({ id: 'o', status: 'PACKED', ready_for_pickup: true, delivery_address: {} }, patch)] };
      if (sql.includes('INSERT')) inserted = true;
      return { rows: [] };
    } } as any);
    try { await assert.rejects(() => claimDelivery('o', 'a', new Date('2026-11-06T06:30:00Z')), (error: any) => error.code === expected); assert.equal(inserted, false); }
    finally { Database.getClient = original; }
  });
}

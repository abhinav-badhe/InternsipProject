import { it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { Database } from '../src/db.js';

it('prototype delivery: winner only, ordered pickup steps, correct OTP and cash, completion retries counted once', async () => {
  const originalQuery = Database.query; const originalClient = Database.getClient;
  const order = { id: 'order-1', order_number: 'ORD-1', status: 'PACKED', ready_for_pickup: true, payment_intent_id: 'COD', grand_total: 54, delivery_address: {} };
  const delivery = { id: 'delivery-1', order_id: order.id, rider_id: 'rider-a', rider_uuid: 'rider-a', status: 'ASSIGNED', delivery_otp: '4321' };
  let creditedDeliveries = 0; let cash = 0;
  Database.query = async () => ({ rows: [], rowCount: 0 } as any); // Bootstrap stays isolated from all real databases.
  Database.getClient = async () => ({ release() {}, async query(sql: string, params?: any[]) {
    if (sql.includes('FROM orders')) return { rows: [order] };
    if (sql.includes('FROM delivery_assignments')) return { rows: [delivery] };
    if (sql.includes('UPDATE delivery_assignments')) {
      if (sql.includes("status = 'REACHED_STORE'")) delivery.status = 'REACHED_STORE';
      if (sql.includes("status = 'IN_TRANSIT'")) delivery.status = 'IN_TRANSIT';
      if (sql.includes("status = 'DELIVERED'")) delivery.status = 'DELIVERED';
    }
    if (sql.includes('UPDATE delivery_riders')) { creditedDeliveries++; cash += params![1]; }
    return { rows: [] };
  } } as any);
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as import('node:net').AddressInfo;
  const update = async (rider: string, status: string, extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/fulfillment/deliveries/ORD-1/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': rider }, body: JSON.stringify({ status, ...extra }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await update('rider-b', 'REACHED_STORE')).status, 403);
    assert.equal((await update('rider-a', 'DELIVERED', { otp: '4321', cashCollected: true })).status, 409);
    assert.equal((await update('rider-a', 'REACHED_STORE')).status, 200);
    assert.equal((await update('rider-a', 'PICKED_UP')).status, 200);
    assert.equal((await update('rider-a', 'DELIVERED', { otp: '9999', cashCollected: true })).status, 400);
    assert.equal((await update('rider-a', 'DELIVERED', { otp: '4321' })).status, 400);
    assert.equal((await update('rider-a', 'DELIVERED', { otp: '4321', cashCollected: true })).status, 200);
    assert.equal((await update('rider-a', 'DELIVERED', { otp: '4321', cashCollected: true })).status, 200);
    assert.equal(creditedDeliveries, 1); assert.equal(cash, 54);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    Database.query = originalQuery; Database.getClient = originalClient;
  }
});

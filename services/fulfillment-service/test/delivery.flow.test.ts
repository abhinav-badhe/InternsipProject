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

it('SEC-04 Fix: strictly validates rider password hash/assigned PIN and rejects universal 1234 bypass', async () => {
  const originalQuery = Database.query;
  const crypto = await import('node:crypto');
  const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const customHash = crypto.scryptSync('SecurePin99', salt, 32).toString('hex');

  const riderWithCustomPin = {
    id: 'rider-custom-1',
    full_name: 'Pooja Nair',
    phone: '+91 99999 88888',
    email: 'pooja@freshcart.in',
    status: 'ONLINE',
    password_hash: `${salt}:${customHash}`,
    pin_code: '7777',
    rating: 4.9,
    total_orders_completed: 10,
    earnings_today: 500,
  };

  Database.query = (async (sql: string, params?: any[]) => {
    if (sql.includes('FROM delivery_riders')) {
      if (params?.[0] === '+91 99999 88888' || params?.[0] === '99999 88888' || params?.[1] === '9999988888') {
        return { rows: [{ ...riderWithCustomPin }], rowCount: 1 } as any;
      }
    }
    if (sql.includes('UPDATE delivery_riders SET status')) {
      return { rows: [], rowCount: 1 } as any;
    }
    return { rows: [], rowCount: 0 } as any;
  }) as any;

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as import('node:net').AddressInfo;

  try {
    // 1. Attempting login with bypass 1234 on a rider with a custom pin must be REJECTED
    const resBypass = await fetch(`http://127.0.0.1:${address.port}/api/v1/fulfillment/delivery-partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail: '+91 99999 88888', password: '1234', pinCode: '1234' }),
    });
    assert.equal(resBypass.status, 401, 'Universal bypass code 1234 must be rejected');

    // 2. Logging in with their actual assigned PIN (7777) must SUCCEED
    const resValid = await fetch(`http://127.0.0.1:${address.port}/api/v1/fulfillment/delivery-partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail: '+91 99999 88888', password: '7777', pinCode: '7777' }),
    });
    assert.equal(resValid.status, 200, 'Actual assigned PIN must be accepted');

    // 3. Logging in with their actual scrypt password (SecurePin99) must SUCCEED
    const resPass = await fetch(`http://127.0.0.1:${address.port}/api/v1/fulfillment/delivery-partners/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneOrEmail: '+91 99999 88888', password: 'SecurePin99' }),
    });
    assert.equal(resPass.status, 200, 'Salted scrypt password must be accepted');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    Database.query = originalQuery;
  }
});

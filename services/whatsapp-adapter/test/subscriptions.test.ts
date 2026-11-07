import { it } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionReply, type SubscriptionClient } from '../src/subscriptions.js';
import type { WhatsAppSessionState } from '@grocery/contracts';

it('WhatsApp subscription requires frequency, chosen window, own address and explicit confirmation; no payment call', async () => {
  const session: WhatsAppSessionState = { sessionId: 's', phoneNumber: '+919000000001', stage: 'IDLE', lastMessageAt: '', cartItems: [{ sku: 'MILK', productName: 'Milk', variantName: '500ml', quantity: 2, unitPrice: 27 }] };
  const requests: any[] = [];
  const client: SubscriptionClient = {
    addresses: async () => [{ label: 'HOME', street: '4 Main Road', city: 'Bengaluru', pincode: '560102' }],
    request: async (owner, path, method, body) => { requests.push({ owner, path, method, body }); return { subscription_number: 'SUB-1', next_delivery_date: '2026-11-06' }; },
  };
  let sequence = 0;
  const send = (text: string) => subscriptionReply(session, { text, messageId: `message-${++sequence}`, fromPhoneNumber: session.phoneNumber, timestamp: '' }, client);
  assert.match((await send('subscribe'))!.bodyText, /How often/);
  await send('weekdays only'); await send('sub_slot_morning-6-8'); await send('sub_address_1');
  assert.equal(requests.length, 0);
  const confirmation = await send('confirm subscription');
  assert.equal(requests.length, 1); assert.equal(requests[0].body.deliverySlot, '06:00 AM - 08:00 AM');
  assert.equal(requests[0].body.frequency, 'WEEKDAYS_ONLY');
  assert.equal(requests[0].body.deliveryAddress.phone, session.phoneNumber);
  assert.equal(requests[0].body.idempotencyKey, 'message-1');
  assert.match(confirmation!.bodyText, /Cash on delivery/); assert.equal(session.cartItems.length, 0);
  assert.equal(session.pendingSubscription, undefined);
});

it('failed subscription creation can be retried with the same key and cancellation preserves the cart', async () => {
  const session: WhatsAppSessionState = { sessionId: 's', phoneNumber: '+919000000001', stage: 'IDLE', lastMessageAt: '', cartItems: [{ sku: 'MILK', productName: 'Milk', variantName: '500ml', quantity: 1, unitPrice: 27 }] };
  const keys: string[] = [];
  const client: SubscriptionClient = { addresses: async () => [], request: async (_owner, _path, _method, body) => { keys.push(body.idempotencyKey); throw new Error('Network interrupted'); } };
  const send = (text: string) => subscriptionReply(session, { text, messageId: text, fromPhoneNumber: session.phoneNumber, timestamp: '' }, client);
  await send('subscribe'); await send('daily'); await send('sub_slot_morning-8-10'); await send('ADDRESS Flat 4 | Bengaluru | 560102');
  await send('sub_confirm'); await send('sub_confirm');
  assert.deepEqual(keys, ['subscribe', 'subscribe']); assert.equal(session.cartItems.length, 1);
  await send('cancel setup'); assert.equal(session.pendingSubscription, undefined); assert.equal(session.cartItems.length, 1);
});

it('WhatsApp subscription allows choosing daily essentials when cart is empty', async () => {
  const session: WhatsAppSessionState = { sessionId: 's2', phoneNumber: '+919000000002', stage: 'IDLE', lastMessageAt: '', cartItems: [] };
  const requests: any[] = [];
  const client: SubscriptionClient = {
    addresses: async () => [{ label: 'HOME', street: '12 Brigade Rd', city: 'Bengaluru', pincode: '560025' }],
    request: async (owner, path, method, body) => { requests.push({ owner, path, method, body }); return { subscription_number: 'SUB-2', next_delivery_date: '2026-11-08' }; },
  };
  let sequence = 0;
  const send = (text: string) => subscriptionReply(session, { text, messageId: `msg-${++sequence}`, fromPhoneNumber: session.phoneNumber, timestamp: '' }, client);

  // 1. Send "subscribe" with empty cart -> shows daily essentials list
  const catalogMsg = await send('subscribe');
  assert.match(catalogMsg!.bodyText, /Daily Essentials Subscriptions/);
  assert.equal(catalogMsg!.options?.length, 5);
  assert.equal(session.pendingSubscription?.step, 'ITEM');

  // 2. Choose option 1 (Amul Taaza Milk 500ml)
  const freqMsg = await send('1');
  assert.match(freqMsg!.bodyText, /Selected \*Amul Taaza Milk 500ml\*/);
  assert.match(freqMsg!.bodyText, /How often should we deliver\?/);
  assert.equal(session.pendingSubscription?.step, 'FREQUENCY');

  // 3. Choose frequency, slot, address and confirm
  await send('daily');
  await send('sub_slot_morning-6-8');
  await send('sub_address_1');
  const confirmMsg = await send('confirm subscription');

  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.sku, 'AMUL-TZ-500ML');
  assert.equal(requests[0].body.frequency, 'DAILY');
  assert.equal(requests[0].body.deliverySlot, '06:00 AM - 08:00 AM');
  assert.match(confirmMsg!.bodyText, /Subscription SUB-2 created/);
  assert.equal(session.pendingSubscription, undefined);
});

it('WhatsApp subscription directly selects essential when specified (e.g. "subscribe milk")', async () => {
  const session: WhatsAppSessionState = { sessionId: 's3', phoneNumber: '+919000000003', stage: 'IDLE', lastMessageAt: '', cartItems: [] };
  const client: SubscriptionClient = {
    addresses: async () => [],
    request: async () => ({ subscription_number: 'SUB-3', next_delivery_date: '2026-11-08' }),
  };
  const send = (text: string) => subscriptionReply(session, { text, messageId: 'm1', fromPhoneNumber: session.phoneNumber, timestamp: '' }, client);

  const freqMsg = await send('subscribe milk');
  assert.match(freqMsg!.bodyText, /Selected \*Amul Taaza Milk/);
  assert.equal(session.pendingSubscription?.step, 'FREQUENCY');
});

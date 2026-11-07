import { Router } from 'express';
import {
  errorResponse, okResponse, SUBSCRIPTION_FREQUENCIES, SUBSCRIPTION_SLOTS,
  SUBSCRIPTION_TIME_ZONE, subscriptionClock, subscriptionSlot, nextSubscriptionDate,
  type CreateOrderRequest, type OrderResponse, type SubscriptionFrequency,
} from '@grocery/contracts';
import { Database } from './db.js';
import crypto from 'node:crypto';

/**
 * Derives a deterministic signed 32-bit integer from a namespace string for PostgreSQL advisory locks:
 * pg_try_advisory_lock(int4, int4) / pg_advisory_unlock(int4, int4)
 * This avoids hardcoded magic numbers (such as 744021) and eliminates lock ID collision risks
 * across multi-tenant, shared databases, microservices, or scheduled background jobs.
 */
export function hashNamespaceTo32BitInt(name: string): number {
  return crypto.createHash('sha256').update(name).digest().readInt32BE(0);
}

export const SUBSCRIPTION_LOCK_NAMESPACE = process.env.ADVISORY_LOCK_NAMESPACE || 'freshcart:order-service';
export const SUBSCRIPTION_LOCK_RESOURCE = 'morning-subscription-processor';

export function getSubscriptionAdvisoryLockKeys(): [number, number] {
  return [
    hashNamespaceTo32BitInt(SUBSCRIPTION_LOCK_NAMESPACE),
    hashNamespaceTo32BitInt(SUBSCRIPTION_LOCK_RESOURCE),
  ];
}

export class SubscriptionProcessor {
  constructor(private readonly checkout: (request: CreateOrderRequest) => Promise<OrderResponse>) {}

  async run(now = new Date()) {
    const client = await Database.getClient();
    let locked = false;
    const [lockNamespace, lockResource] = getSubscriptionAdvisoryLockKeys();
    const result = { processedCount: 0, skippedCount: 0, createdOrders: [] as any[], errors: [] as any[] };
    try {
      // A session lock covers all service replicas and manual/automatic triggers, namespaced to prevent collisions.
      locked = (await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [lockNamespace, lockResource])).rows[0]?.locked === true;
      if (!locked) return { ...result, busy: true };
      const clock = subscriptionClock(now);
      const due = await client.query(`SELECT *, next_delivery_date::text AS due_date
        FROM customer_subscriptions WHERE status = 'ACTIVE' AND next_delivery_date <= $1::date ORDER BY created_at`, [clock.date]);
      for (const sub of due.rows) {
        try {
          const slot = subscriptionSlot(sub.delivery_slot);
          if (!slot) throw new Error('Choose a supported morning delivery window for this subscription.');
          const frequency = sub.frequency as SubscriptionFrequency;
          if (!SUBSCRIPTION_FREQUENCIES.includes(frequency)) throw new Error('Unsupported subscription frequency.');
          // Keep alternate-day/weekly cadence when recovering from downtime.
          const dueDate = sub.due_date < clock.date
            ? nextSubscriptionDate(sub.due_date, frequency, previousDate(clock.date))
            : sub.due_date;
          const weekend = [0, 6].includes(new Date(`${clock.date}T12:00:00Z`).getUTCDay());
          const skippedDates: string[] = Array.isArray(sub.skipped_dates) ? sub.skipped_dates : (typeof sub.skipped_dates === 'string' ? JSON.parse(sub.skipped_dates || '[]') : []);
          if (skippedDates.includes(clock.date)) {
            const next = nextSubscriptionDate(clock.date, frequency);
            await client.query('UPDATE customer_subscriptions SET next_delivery_date = $1, updated_at = NOW() WHERE id = $2', [next, sub.id]);
            result.skippedCount++;
            continue;
          }
          if (dueDate > clock.date || (frequency === 'WEEKDAYS_ONLY' && weekend) || clock.minute >= slot.endMinute) {
            const next = dueDate > clock.date ? dueDate : nextSubscriptionDate(clock.date, frequency);
            await client.query('UPDATE customer_subscriptions SET next_delivery_date = $1, updated_at = NOW() WHERE id = $2', [next, sub.id]);
            result.skippedCount++;
            continue;
          }
          // Prepare before the chosen window, never generate morning orders at noon.
          if (clock.minute < slot.startMinute - 60) continue;
          const fresh = await client.query('SELECT status FROM customer_subscriptions WHERE id = $1', [sub.id]);
          if (fresh.rows[0]?.status !== 'ACTIVE') continue;
          const address = typeof sub.delivery_address === 'string' ? JSON.parse(sub.delivery_address) : sub.delivery_address;
          const order = await this.checkout({
            idempotencyKey: `subscription:${sub.id}:${clock.date}`,
            paymentMethod: 'COD', channel: sub.channel || 'WEB', customerId: sub.customer_id,
            items: [{ sku: sub.sku, quantity: Number(sub.quantity) }],
            deliveryAddress: {
              ...address, addressLine1: address.addressLine1 || address.street,
              slot: slot.label, slotId: `subscription-${slot.id}`, scheduledFor: clock.date,
              deliveryWindowStart: `${clock.date}T${String(Math.floor(slot.startMinute / 60)).padStart(2, '0')}:00:00+05:30`,
              deliveryWindowEnd: `${clock.date}T${String(Math.floor(slot.endMinute / 60)).padStart(2, '0')}:00:00+05:30`,
              timeZone: SUBSCRIPTION_TIME_ZONE, subscriptionNumber: sub.subscription_number,
            },
          });
          if (order.status === 'CANCELLED') throw new Error('The scheduled order was cancelled.');
          await client.query('BEGIN');
          try {
            await client.query(`INSERT INTO subscription_execution_logs (subscription_id, order_id, order_number, execution_date, status)
              SELECT $1, $2, $3, $4::date, 'COMPLETED' WHERE NOT EXISTS
              (SELECT 1 FROM subscription_execution_logs WHERE subscription_id = $1 AND execution_date = $4::date AND status = 'COMPLETED')`,
            [sub.id, order.orderId, order.orderNumber, clock.date]);
            await client.query('UPDATE customer_subscriptions SET next_delivery_date = $1, updated_at = NOW() WHERE id = $2',
              [nextSubscriptionDate(clock.date, frequency), sub.id]);
            await client.query('COMMIT');
          } catch (error) { await client.query('ROLLBACK'); throw error; }
          result.processedCount++;
          result.createdOrders.push({ subscriptionNumber: sub.subscription_number, orderId: order.orderId, deliverySlot: slot.label });
        } catch (error: any) {
          result.errors.push({ subscriptionNumber: sub.subscription_number, error: error.message });
        }
      }
      return result;
    } finally {
      if (locked) await client.query('SELECT pg_advisory_unlock($1, $2)', [lockNamespace, lockResource]).catch(() => {});
      client.release();
    }
  }
}

function previousDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function subscriptionRoutes(processor: SubscriptionProcessor, quote: (sku: string, quantity: number) => Promise<any>): import('express').Router {
  const router = Router();
  router.get('/slots', (_req, res) => res.json(okResponse({ slots: SUBSCRIPTION_SLOTS, timeZone: SUBSCRIPTION_TIME_ZONE }, 'subscriptions')));
  router.post('/process-daily', async (req, res, next) => {
    if (req.headers['x-user-role'] !== 'STORE_ADMIN') return res.status(403).json(errorResponse('FORBIDDEN', 'Only store staff can trigger the scheduler.', 'subscriptions'));
    try { res.json(okResponse(await processor.run(), 'subscriptions')); } catch (error) { next(error); }
  });
  router.get('/execution-logs', async (req, res, next) => {
    if (req.headers['x-user-role'] !== 'STORE_ADMIN') return res.status(403).json(errorResponse('FORBIDDEN', 'Store staff access required.', 'subscriptions'));
    try { res.json(okResponse((await Database.query('SELECT * FROM subscription_execution_logs ORDER BY created_at DESC LIMIT 50')).rows, 'subscriptions')); } catch (error) { next(error); }
  });
  router.use((req, res, next) => {
    if (!req.headers['x-user-id']) return res.status(401).json(errorResponse('UNAUTHORIZED', 'Customer identity required.', 'subscriptions'));
    next();
  });
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const userPhone = req.headers['x-user-phone'] as string | undefined;

      let clean10 = '';
      if (userPhone) {
        clean10 = userPhone.replace(/[^0-9]/g, '').slice(-10);
      } else if (userId && !userId.startsWith('phone_')) {
        try {
          const uRes = await Database.query('SELECT phone FROM users WHERE id::text = $1', [userId]);
          if (uRes.rows[0]?.phone) {
            clean10 = uRes.rows[0].phone.replace(/[^0-9]/g, '').slice(-10);
          }
        } catch {}
      }

      let queryText = 'SELECT * FROM customer_subscriptions WHERE customer_id = $1';
      const queryParams: any[] = [userId];

      if (clean10) {
        queryText += ` OR customer_id = $2 OR customer_id = $3 OR customer_id = $4 OR customer_id LIKE $5 OR delivery_address->>'phone' LIKE $5`;
        queryParams.push(`phone_${clean10}`, `phone_91${clean10}`, `phone_+91${clean10}`, `%${clean10}%`);
      }

      queryText += ' ORDER BY created_at DESC';
      const result = await Database.query(queryText, queryParams);
      res.json(okResponse(result.rows, 'subscriptions'));
    } catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const { sku, productName, variantName, deliveryAddress } = req.body;
      const quantity = Number(req.body.quantity ?? 1);
      const frequency = req.body.frequency || 'DAILY';
      const slot = subscriptionSlot(req.body.deliverySlot || 'morning-7-9');
      if (!sku || !productName || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || !SUBSCRIPTION_FREQUENCIES.includes(frequency) || !slot)
        return res.status(400).json(errorResponse('INVALID_PARAM', 'Choose a product, valid quantity/frequency, and a morning delivery slot.', 'subscriptions'));
      if (!deliveryAddress || !(deliveryAddress.addressLine1 || deliveryAddress.street) || !deliveryAddress.city || !(deliveryAddress.postalCode || deliveryAddress.pincode) || !deliveryAddress.phone)
        return res.status(400).json(errorResponse('INVALID_ADDRESS', 'A saved delivery address and phone number are required.', 'subscriptions'));
      const pricing = await quote(sku, quantity);
      const item = pricing.items?.find((item: any) => item.sku === sku);
      if (!item || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) <= 0) throw new Error('No current price is available for this product.');
      const date = nextSubscriptionDate(subscriptionClock().date, frequency);
      const number = `SUB-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
      const owner = req.headers['x-user-id'];
      const key = req.body.idempotencyKey ? `${owner}:${req.body.idempotencyKey}` : null;
      const inserted = await Database.query(`INSERT INTO customer_subscriptions
        (subscription_number, customer_id, sku, product_name, variant_name, quantity, unit_price, frequency, delivery_slot, start_date, next_delivery_date, delivery_address, channel, creation_key)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13)
        ON CONFLICT (creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key RETURNING *`,
        [number, owner, sku, item.productName || productName, item.variantName || variantName || 'Standard', quantity, item.unitPrice, frequency, slot.label, date, JSON.stringify(deliveryAddress), req.body.channel === 'WHATSAPP' ? 'WHATSAPP' : 'WEB', key]);

      // Proactive WhatsApp confirmation to customer's mobile
      try {
        const phone = deliveryAddress.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `🔁 *FreshCart Subscription Confirmed!*\n\nHello ${deliveryAddress.recipientName || 'Valued Customer'},\nYour morning subscription has been confirmed!\n\n🆔 *Subscription Number:* *${number}*\n📦 *Item:* ${item.productName || productName} (${item.variantName || variantName || 'Standard'}) × ${quantity}\n🗓️ *Frequency:* ${frequency}\n⏰ *Delivery Slot:* ${slot.label} IST\n💰 *Price per delivery:* ₹${Number(item.unitPrice).toFixed(2)}\n\nFirst scheduled delivery is set for *${date}*. You can manage, pause or cancel anytime from the Storefront or WhatsApp!`,
            }),
          }).catch(() => {});
        }
      } catch {}

      res.status(201).json(okResponse(inserted.rows[0], 'subscriptions'));
    } catch (error) { next(error); }
  });
  router.patch('/:id', async (req, res, next) => {
    try {
      const slot = subscriptionSlot(req.body.deliverySlot);
      if (!slot) return res.status(400).json(errorResponse('INVALID_SLOT', 'Choose a supported morning window.', 'subscriptions'));
      
      const userId = req.headers['x-user-id'] as string;
      let clean10 = '';
      if (req.headers['x-user-phone']) {
        clean10 = String(req.headers['x-user-phone']).replace(/[^0-9]/g, '').slice(-10);
      } else if (userId && !userId.startsWith('phone_')) {
        try {
          const uRes = await Database.query('SELECT phone FROM users WHERE id::text = $1', [userId]);
          if (uRes.rows[0]?.phone) clean10 = uRes.rows[0].phone.replace(/[^0-9]/g, '').slice(-10);
        } catch {}
      }

      const result = await Database.query(`
        UPDATE customer_subscriptions SET delivery_slot=$1, updated_at=NOW()
        WHERE (id::text=$2 OR subscription_number=$2) 
          AND (customer_id=$3 OR ($4 != '' AND (customer_id LIKE $5 OR delivery_address->>'phone' LIKE $5)))
          AND status != 'CANCELLED' 
        RETURNING *`, 
        [slot.label, req.params.id, userId, clean10, `%${clean10}%`]);
      if (!result.rows.length) return res.status(404).json(errorResponse('NOT_FOUND', 'Subscription not found.', 'subscriptions'));
      res.json(okResponse(result.rows[0], 'subscriptions'));
    } catch (error) { next(error); }
  });
  for (const [action, status] of [['pause', 'PAUSED'], ['resume', 'ACTIVE'], ['cancel', 'CANCELLED']] as const) {
    const handler: import('express').RequestHandler = async (req, res, next) => {
      try {
        const userId = req.headers['x-user-id'] as string;
        let clean10 = '';
        if (req.headers['x-user-phone']) {
          clean10 = String(req.headers['x-user-phone']).replace(/[^0-9]/g, '').slice(-10);
        } else if (userId && !userId.startsWith('phone_')) {
          try {
            const uRes = await Database.query('SELECT phone FROM users WHERE id::text = $1', [userId]);
            if (uRes.rows[0]?.phone) clean10 = uRes.rows[0].phone.replace(/[^0-9]/g, '').slice(-10);
          } catch {}
        }

        const result = await Database.query(`
          SELECT * FROM customer_subscriptions 
          WHERE (id::text=$1 OR subscription_number=$1) 
            AND (customer_id=$2 OR ($3 != '' AND (customer_id LIKE $4 OR delivery_address->>'phone' LIKE $4)))`, 
          [req.params.id, userId, clean10, `%${clean10}%`]);
        const sub = result.rows[0];
        if (!sub || (sub.status === 'CANCELLED' && action !== 'cancel')) return res.status(404).json(errorResponse('NOT_FOUND', 'Active subscription not found.', 'subscriptions'));
        const date = action === 'resume' ? nextSubscriptionDate(subscriptionClock().date, sub.frequency) : sub.next_delivery_date;
        await Database.query('UPDATE customer_subscriptions SET status=$1, next_delivery_date=$2, updated_at=NOW() WHERE id=$3', [status, date, sub.id]);

        // Proactive WhatsApp notification for subscription pause / resume / cancel
        try {
          const addr = typeof sub.delivery_address === 'string' ? JSON.parse(sub.delivery_address) : sub.delivery_address;
          const phone = addr?.phone;
          if (phone) {
            const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
            const actionText = status === 'PAUSED' ? 'PAUSED ⏸️' : status === 'ACTIVE' ? 'RESUMED ▶️' : 'CANCELLED ❌';
            fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: phone,
                bodyText: `🔁 *FreshCart Subscription Update*\n\nYour subscription *${sub.subscription_number}* (${sub.product_name}) is now *${actionText}*.\n\n${status === 'ACTIVE' ? `Next scheduled delivery: *${date}*` : 'You can resume your subscription anytime from the Storefront or WhatsApp.'}`,
              }),
            }).catch(() => {});
          }
        } catch {}

        res.json(okResponse({ success: true, status }, 'subscriptions'));
      } catch (error) { next(error); }
    };
    router.post(`/:id/${action}`, handler);
    if (action === 'cancel') router.delete('/:id', handler);
  }

  // Feature: Skip Single Scheduled Delivery Date
  router.post('/:id/skip', async (req, res, next) => {
    try {
      const id = req.params.id;
      const { skipDate } = req.body || {};
      const targetDate = skipDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      await Database.query(`ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS skipped_dates JSONB DEFAULT '[]'::jsonb;`).catch(() => {});

      const existing = await Database.query(`SELECT * FROM customer_subscriptions WHERE id::text = $1 OR subscription_number = $1`, [id]);
      if (existing.rows.length === 0) return res.status(404).json(errorResponse('NOT_FOUND', 'Subscription not found', 'subscriptions'));
      const sub = existing.rows[0];

      const currentSkips: string[] = Array.isArray(sub.skipped_dates) ? sub.skipped_dates : (typeof sub.skipped_dates === 'string' ? JSON.parse(sub.skipped_dates || '[]') : []);
      if (!currentSkips.includes(targetDate)) {
        currentSkips.push(targetDate);
      }

      await Database.query(
        `UPDATE customer_subscriptions SET skipped_dates = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(currentSkips), sub.id]
      );

      // Send WhatsApp notification
      try {
        const addr = typeof sub.delivery_address === 'string' ? JSON.parse(sub.delivery_address) : sub.delivery_address;
        const phone = addr?.phone;
        if (phone) {
          const waUrl = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';
          fetch(`${waUrl}/api/v1/whatsapp/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: phone,
              bodyText: `⏸️ *FreshCart Subscription Delivery Skipped*\n\nYour delivery on *${targetDate}* for subscription *${sub.subscription_number}* (${sub.product_name}) has been skipped.\n\nDeliveries will resume automatically on the next cycle with no charges!`,
            }),
          }).catch(() => {});
        }
      } catch {}

      res.json(okResponse({ success: true, subscriptionNumber: sub.subscription_number, skippedDate: targetDate, allSkippedDates: currentSkips }, 'subscriptions'));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

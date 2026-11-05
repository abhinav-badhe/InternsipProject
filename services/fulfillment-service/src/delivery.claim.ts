import crypto from 'node:crypto';
import { Database } from './db.js';

export class DeliveryClaimError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function claimDelivery(orderId: string, riderId: string, now = new Date()) {
  if (!orderId || !riderId) throw new DeliveryClaimError(400, 'INVALID_PARAM', 'Order and registered rider are required.');
  const client = await Database.getClient();
  try {
    await client.query('BEGIN');
    // Lock the existing order, not the possibly-empty assignment result set.
    const order = (await client.query(`SELECT id, order_number, status, ready_for_pickup, delivery_address, grand_total
      FROM orders WHERE id::text = $1 OR order_number = $1 FOR UPDATE`, [orderId])).rows[0];
    if (!order) throw new DeliveryClaimError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    const existing = (await client.query("SELECT id FROM delivery_assignments WHERE order_id=$1 AND status != 'CANCELLED'", [order.id])).rows[0];
    if (existing) throw new DeliveryClaimError(409, 'ORDER_ALREADY_ACCEPTED', 'Another delivery partner already accepted this order.');
    if (order.status !== 'PACKED' || !order.ready_for_pickup) throw new DeliveryClaimError(409, 'ORDER_NOT_READY', 'This order is not packed and ready for pickup.');
    const address = typeof order.delivery_address === 'string' ? JSON.parse(order.delivery_address) : order.delivery_address || {};
    if (address.deliveryWindowStart && now < new Date(address.deliveryWindowStart)) throw new DeliveryClaimError(409, 'DELIVERY_NOT_DUE', 'The selected delivery window has not started.');
    if (address.deliveryWindowEnd && now >= new Date(address.deliveryWindowEnd)) throw new DeliveryClaimError(409, 'DELIVERY_WINDOW_MISSED', 'The selected delivery window has ended. Contact the store.');
    // A rider row lock also prevents one rider claiming two different orders concurrently.
    const rider = (await client.query('SELECT id, full_name, phone, status, approval_status FROM delivery_riders WHERE id::text=$1 FOR UPDATE', [riderId])).rows[0];
    if (!rider || rider.approval_status === 'REJECTED') throw new DeliveryClaimError(403, 'RIDER_UNAVAILABLE', 'A registered active delivery partner is required.');
    if (rider.status !== 'ONLINE') throw new DeliveryClaimError(409, 'RIDER_NOT_ONLINE', 'Go online and finish your current delivery before accepting another.');
    const id = crypto.randomUUID();
    await client.query(`INSERT INTO delivery_assignments
      (id, order_id, order_number, rider_id, rider_name, rider_phone, status, delivery_address, delivery_otp, rider_uuid, assigned_at)
      VALUES ($1,$2,$3,$4,$5,$6,'ASSIGNED',$7,$8,$9,NOW())`,
      [id, order.id, order.order_number, rider.id, rider.full_name, rider.phone, JSON.stringify(address), String(crypto.randomInt(1000, 10000)), rider.id]);
    await client.query("UPDATE delivery_riders SET status='ON_DELIVERY', last_active_at=NOW() WHERE id=$1", [rider.id]);
    await client.query('UPDATE orders SET ready_for_pickup=FALSE, updated_at=NOW() WHERE id=$1', [order.id]);
    await client.query('COMMIT');
    return { deliveryId: id, orderId: order.id, orderNumber: order.order_number, riderId: rider.id,
      riderName: rider.full_name, riderPhone: rider.phone, status: 'ASSIGNED', assignedAt: now.toISOString() };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

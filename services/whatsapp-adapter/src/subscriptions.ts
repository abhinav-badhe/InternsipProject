import { SUBSCRIPTION_FREQUENCIES, SUBSCRIPTION_SLOTS, type WhatsAppSessionState, type WhatsAppInboundMessage, type WhatsAppOutboundMessage } from '@grocery/contracts';
import { Database } from './db.js';

export interface SubscriptionClient {
  request(owner: string, path: string, method?: string, body?: any): Promise<any>;
  addresses(owner: string, phone: string): Promise<any[]>;
}

export const httpSubscriptionClient: SubscriptionClient = {
  async request(owner, path, method = 'GET', body) {
    const response = await fetch(`${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/subscriptions${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-user-id': owner },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000),
    });
    const json: any = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error?.message || 'Subscriptions are temporarily unavailable. Try again.');
    return json.data;
  },
  async addresses(owner, phone) {
    return (await Database.query(`SELECT * FROM customer_addresses WHERE customer_id=$1
      OR regexp_replace(phone, '[^0-9]', '', 'g') = $2 ORDER BY is_default DESC, created_at DESC LIMIT 5`,
      [owner, phone.replace(/[^0-9]/g, '')])).rows;
  },
};

export async function subscriptionReply(session: WhatsAppSessionState, message: WhatsAppInboundMessage, client: SubscriptionClient): Promise<WhatsAppOutboundMessage | null> {
  const text = message.text.trim();
  const lower = text.toLowerCase();
  const owner = session.customerId || `phone_${message.fromPhoneNumber.replace(/[^0-9]/g, '')}`;
  const reply = (bodyText: string, options?: Array<{ id: string; title: string }>): WhatsAppOutboundMessage => ({ toPhoneNumber: message.fromPhoneNumber, bodyText, type: options ? (options.length > 3 ? 'list' : 'buttons') : 'text', options });
  let draft = session.pendingSubscription;
  if (lower === 'cancel setup' || lower === 'sub_abort') {
    session.pendingSubscription = undefined;
    return reply('Subscription setup cancelled. Your shopping cart is unchanged.');
  }
  try {
    if (lower === 'subscriptions' || lower === 'my subscriptions') {
      const subscriptions = await client.request(owner, '');
      return reply(subscriptions.length ? subscriptions.map((sub: any) => `${sub.subscription_number}: ${sub.product_name} × ${sub.quantity}\n${sub.frequency} · ${sub.delivery_slot} IST · ${sub.status}\nNext: ${String(sub.next_delivery_date).slice(0, 10)}`).join('\n\n') + '\n\nReply PAUSE <SUB-number>, RESUME <SUB-number>, CANCEL <SUB-number>, or SLOT <SUB-number>. Cash on delivery.' : 'No subscriptions yet. Add one daily essential to your cart, then reply SUBSCRIBE.');
    }
    const action = text.match(/^(pause|resume|cancel|slot)\s+(SUB-[\w-]+)$/i);
    if (action) {
      const id = action[2].toUpperCase();
      if (action[1].toLowerCase() !== 'slot') {
        await client.request(owner, `/${id}/${action[1].toLowerCase()}`, 'POST');
        return reply(`${id}: ${action[1].toLowerCase() === 'pause' ? 'paused' : action[1].toLowerCase() === 'resume' ? 'resumed from the next eligible day' : 'cancelled'}.`);
      }
      const subscriptions = await client.request(owner, '');
      if (!subscriptions.some((sub: any) => sub.subscription_number === id && sub.status !== 'CANCELLED')) return reply('Subscription not found. Reply SUBSCRIPTIONS to see yours.');
      draft = session.pendingSubscription = { step: 'SLOT', subscriptionId: id, key: message.messageId };
    } else if (['subscribe', 'subscription', 'daily delivery'].includes(lower)) {
      if (session.cartItems.length !== 1) return reply('Add one product and pack size to your cart, then reply SUBSCRIBE. You can set up milk, bread, and other essentials separately.');
      draft = session.pendingSubscription = { step: 'FREQUENCY', item: { ...session.cartItems[0] }, key: message.messageId };
      return reply('How often should we deliver? Payment is cash on delivery. Reply CANCEL SETUP to stop.', SUBSCRIPTION_FREQUENCIES.map((frequency) => ({ id: `sub_freq_${frequency}`, title: frequency.toLowerCase().replaceAll('_', ' ') })));
    }
    if (!draft) return null;
    if (draft.step === 'FREQUENCY') {
      const frequency = text.replace(/^sub_freq_/i, '').toUpperCase().replaceAll(' ', '_');
      if (!SUBSCRIPTION_FREQUENCIES.includes(frequency as any)) return reply('Choose daily, alternate days, weekdays only, or weekly.');
      draft.frequency = frequency as typeof SUBSCRIPTION_FREQUENCIES[number];
      draft.step = 'SLOT';
      return reply('Choose your morning delivery window (India time).', SUBSCRIPTION_SLOTS.map((slot) => ({ id: `sub_slot_${slot.id}`, title: slot.title })));
    }
    if (draft.step === 'SLOT') {
      const choice = text.replace(/^sub_slot_/i, '');
      const slot = SUBSCRIPTION_SLOTS.find((slot, index) => slot.id === choice || slot.label === choice || slot.title.toLowerCase() === lower || String(index + 1) === text);
      if (!slot) return reply('Choose your morning delivery window (India time).', SUBSCRIPTION_SLOTS.map((slot) => ({ id: `sub_slot_${slot.id}`, title: slot.title })));
      draft.slot = slot.label;
      if (draft.subscriptionId) {
        draft.step = 'CONFIRM';
      } else {
        draft.addresses = await client.addresses(owner, message.fromPhoneNumber);
        draft.step = 'ADDRESS';
        if (draft.addresses.length) return reply('Choose the delivery address for this subscription.', draft.addresses.map((address, index) => ({ id: `sub_address_${index + 1}`, title: `${index + 1}. ${address.label || 'Address'}` })));
        return reply('Send ADDRESS street and flat | city | postal code. Example: ADDRESS Flat 4, Main Road | Bengaluru | 560102');
      }
    } else if (draft.step === 'ADDRESS') {
      const index = Number(text.replace(/^sub_address_/i, '')) - 1;
      const saved = draft.addresses?.[index];
      if (saved) draft.address = { ...saved, recipientName: saved.recipient_name || saved.recipientName || message.senderName || 'Customer', phone: message.fromPhoneNumber, addressLine1: [saved.flat_number || saved.flatNumber, saved.street || saved.addressLine1].filter(Boolean).join(', '), postalCode: saved.pincode || saved.postalCode };
      else {
        const parts = text.replace(/^address\s+/i, '').split('|').map((part) => part.trim());
        if (!/^address\s+/i.test(text) || parts.length !== 3 || !parts[0] || !parts[1] || !/^\d{6}$/.test(parts[2])) return reply('Choose a saved address or send ADDRESS street and flat | city | six-digit postal code.');
        draft.address = { recipientName: message.senderName || 'Customer', phone: message.fromPhoneNumber, addressLine1: parts[0], city: parts[1], postalCode: parts[2] };
      }
      draft.step = 'CONFIRM';
    } else if (draft.step === 'CONFIRM' && ['sub_confirm', 'confirm subscription'].includes(lower)) {
      if (draft.subscriptionId) {
        await client.request(owner, `/${draft.subscriptionId}`, 'PATCH', { deliverySlot: draft.slot });
      } else {
        const item = draft.item!;
        const created = await client.request(owner, '', 'POST', { ...item, frequency: draft.frequency, deliverySlot: draft.slot, deliveryAddress: draft.address, idempotencyKey: draft.key, channel: 'WHATSAPP' });
        session.cartItems = [];
        session.pendingSubscription = undefined;
        return reply(`Subscription ${created.subscription_number} created.\n${item.productName} × ${item.quantity}\n${draft.frequency} · ${draft.slot} IST\nFirst delivery: ${String(created.next_delivery_date).slice(0, 10)}\nCash on delivery; no wallet deduction. Reply SUBSCRIPTIONS to manage it.`);
      }
      session.pendingSubscription = undefined;
      return reply(`Updated ${draft.subscriptionId} to ${draft.slot} IST. Orders already being prepared keep their original window.`);
    }
    return reply(`Confirm ${draft.subscriptionId ? `the new window for ${draft.subscriptionId}` : `${draft.item?.productName} × ${draft.item?.quantity} (${draft.frequency})`}:\n${draft.slot} IST\n${draft.address?.addressLine1 || ''}\nCash on delivery. New subscriptions start on the next eligible day.`, [{ id: 'sub_confirm', title: 'Confirm subscription' }, { id: 'sub_abort', title: 'Cancel setup' }]);
  } catch (error: any) { return reply(`${error.message}\nYour change was not confirmed. Retry or reply CANCEL SETUP.`); }
}

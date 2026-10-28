import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../src/notification.service.js';
import { Database } from '../src/db.js';

describe('NotificationService - Multi-Channel Delivery & Opt-Out', () => {
  const service = new NotificationService();

  it('successfully dispatches order confirmation notification via WhatsApp', async () => {
    let loggedNotification: any = null;

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('SELECT whatsapp_enabled')) {
        return {
          rowCount: 1,
          rows: [{ whatsapp_enabled: true, email_enabled: true, opted_out_marketing: false }],
        };
      }
      if (text.includes('INSERT INTO notification_logs')) {
        loggedNotification = {
          id: params?.[0],
          recipient_id: params?.[1],
          recipient_address: params?.[2],
          channel: params?.[3],
          template_code: params?.[4],
          status: 'SENT',
          provider_message_id: params?.[6],
        };
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const res = await service.notifyOrderConfirmed({
      orderNumber: 'ORD-NOTIF-001',
      customerId: 'cust-notif-1',
      customerPhone: '+919876543210',
      grandTotal: 540.0,
      itemCount: 3,
    });

    assert.equal(res.status, 'SENT');
    assert.ok(res.providerMessageId?.startsWith('msg_whatsapp_'));
    assert.equal(loggedNotification.channel, 'WHATSAPP');
    assert.equal(loggedNotification.template_code, 'ORDER_CONFIRMATION');
  });

  it('strictly respects user marketing opt-out preferences', async () => {
    let loggedNotification: any = null;

    Database.query = async (text: string, params?: any[]): Promise<any> => {
      if (text.includes('SELECT whatsapp_enabled')) {
        return {
          rowCount: 1,
          rows: [{ whatsapp_enabled: true, email_enabled: true, opted_out_marketing: true }],
        };
      }
      if (text.includes('INSERT INTO notification_logs')) {
        loggedNotification = {
          id: params?.[0],
          recipient_id: params?.[1],
          status: 'OPTED_OUT',
        };
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    };

    const res = await service.sendNotification({
      recipientId: 'cust-optout-user',
      recipientAddress: '+919999988888',
      channel: 'WHATSAPP',
      templateCode: 'DIWALI_DISCOUNT_PROMO',
      payload: { promoCode: 'DIWALI50' },
      isMarketing: true,
    });

    assert.equal(res.status, 'OPTED_OUT');
    assert.equal(loggedNotification.status, 'OPTED_OUT');
  });
});

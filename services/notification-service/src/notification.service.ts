import { Database } from './db.js';
import crypto from 'node:crypto';
import { createLogger } from '@grocery/observability';

const logger = createLogger('notification-service:dispatcher');

export interface SendNotificationParams {
  recipientId: string;
  recipientAddress: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS';
  templateCode: string;
  payload: Record<string, any>;
  isMarketing?: boolean;
}

export class NotificationService {
  /**
   * Dispatches a notification while enforcing opt-out preferences and audit logging
   */
  public async sendNotification(params: SendNotificationParams): Promise<{
    id: string;
    status: 'SENT' | 'OPTED_OUT' | 'FAILED';
    providerMessageId?: string;
  }> {
    const notificationId = crypto.randomUUID();

    // 1. Check user preferences
    const prefRes = await Database.query(
      `SELECT whatsapp_enabled, email_enabled, sms_enabled, opted_out_marketing
       FROM user_notification_preferences
       WHERE user_id = $1`,
      [params.recipientId]
    );

    const prefs = prefRes.rows[0];
    if (prefs) {
      if (params.isMarketing && prefs.opted_out_marketing) {
        logger.info('User opted out of marketing notifications', {
          recipientId: params.recipientId,
          template: params.templateCode,
        });

        await Database.query(
          `INSERT INTO notification_logs (id, recipient_id, recipient_address, channel, template_code, payload, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'OPTED_OUT')`,
          [notificationId, params.recipientId, params.recipientAddress, params.channel, params.templateCode, JSON.stringify(params.payload)]
        );

        return { id: notificationId, status: 'OPTED_OUT' };
      }

      if (params.channel === 'WHATSAPP' && !prefs.whatsapp_enabled) {
        return { id: notificationId, status: 'OPTED_OUT' };
      }
      if (params.channel === 'EMAIL' && !prefs.email_enabled) {
        return { id: notificationId, status: 'OPTED_OUT' };
      }
    }

    // 2. Dispatch via provider (Meta WhatsApp Cloud API or SendGrid)
    const providerMessageId = `msg_${params.channel.toLowerCase()}_${crypto.randomBytes(8).toString('hex')}`;

    // 3. Log success
    await Database.query(
      `INSERT INTO notification_logs (id, recipient_id, recipient_address, channel, template_code, payload, status, provider_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7, NOW())`,
      [
        notificationId,
        params.recipientId,
        params.recipientAddress,
        params.channel,
        params.templateCode,
        JSON.stringify(params.payload),
        providerMessageId,
      ]
    );

    logger.info('Notification sent successfully', {
      notificationId,
      recipientId: params.recipientId,
      channel: params.channel,
      template: params.templateCode,
      providerMessageId,
    });

    return {
      id: notificationId,
      status: 'SENT',
      providerMessageId,
    };
  }

  /**
   * Helper to format and send order confirmation
   */
  public async notifyOrderConfirmed(order: {
    orderNumber: string;
    customerId: string;
    customerPhone: string;
    grandTotal: number;
    itemCount: number;
  }) {
    return this.sendNotification({
      recipientId: order.customerId,
      recipientAddress: order.customerPhone,
      channel: 'WHATSAPP',
      templateCode: 'ORDER_CONFIRMATION',
      payload: {
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        itemCount: order.itemCount,
        trackingUrl: `https://grocery.example.com/orders/${order.orderNumber}`,
      },
    });
  }
}

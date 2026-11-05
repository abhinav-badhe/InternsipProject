import { createLogger } from '@grocery/observability';
import crypto from 'node:crypto';

const logger = createLogger('whatsapp-adapter:meta-client');

export interface MetaSendResult {
  success: boolean;
  messageId: string;
  recipientPhone: string;
  mock: boolean;
  error?: string;
}

export interface MetaInteractiveButton {
  id: string;
  title: string;
}

export interface MetaListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export class WhatsAppCloudApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string | undefined;
  private readonly phoneNumberId: string | undefined;

  constructor(options?: {
    accessToken?: string;
    phoneNumberId?: string;
    graphVersion?: string;
  }) {
    this.accessToken =
      options?.accessToken ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      process.env.WHATSAPP_TOKEN ||
      process.env.META_WHATSAPP_TOKEN ||
      process.env.META_ACCESS_TOKEN;
    this.phoneNumberId =
      options?.phoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_ID ||
      process.env.META_PHONE_NUMBER_ID;
    const version = options?.graphVersion || 'v19.0';
    this.baseUrl = `https://graph.facebook.com/${version}`;
  }

  /**
   * Returns true if production WhatsApp Cloud API credentials are configured
   */
  public isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  /**
   * Send a standard text message with optional link preview
   */
  public async sendTextMessage(
    toPhone: string,
    bodyText: string,
    options?: { previewUrl?: boolean }
  ): Promise<MetaSendResult> {
    const formattedPhone = this.formatPhone(toPhone);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: options?.previewUrl ?? true,
        body: bodyText,
      },
    };

    return this.postToMeta(formattedPhone, payload);
  }

  /**
   * Send an interactive button reply message (up to 3 buttons)
   * e.g. for Category Disambiguation or Substitution Accept/Reject
   */
  public async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: MetaInteractiveButton[],
    options?: { headerText?: string; footerText?: string }
  ): Promise<MetaSendResult> {
    const formattedPhone = this.formatPhone(toPhone);

    // Meta WhatsApp Cloud API limits quick-reply buttons to maximum 3
    // Meta strictly enforces: max 20 chars per button title, and NO duplicate titles!
    const seenTitles = new Set<string>();
    const safeButtons = buttons.slice(0, 3).map((btn, idx) => {
      let title = (btn.title || '').trim().replace(/\s+/g, ' ');
      if (title.length > 20) {
        title = title.substring(0, 20).trim();
      }
      if (!title) {
        title = `Option ${idx + 1}`;
      }
      if (seenTitles.has(title.toLowerCase())) {
        const suffix = ` #${idx + 1}`;
        title = `${title.slice(0, 20 - suffix.length)}${suffix}`;
      }
      seenTitles.add(title.toLowerCase());
      return {
        type: 'reply',
        reply: {
          id: (btn.id || `btn_${idx}`).substring(0, 256),
          title,
        },
      };
    });

    // Meta WhatsApp Cloud API strictly limits interactive body text to 1024 characters.
    // If text exceeds 1024 chars, send the detailed message via standard text message (supports 4096 chars)
    // and deliver the interactive buttons with an action prompt so the API call never fails.
    if (bodyText.length > 1024) {
      await this.sendTextMessage(formattedPhone, bodyText);

      const interactive: any = {
        type: 'button',
        body: { text: '👆 Please review the order breakdown above. Tap below to proceed:' },
        action: { buttons: safeButtons },
      };

      if (options?.footerText) {
        interactive.footer = { text: options.footerText.substring(0, 60) };
      }

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'interactive',
        interactive,
      };

      return this.postToMeta(formattedPhone, payload);
    }

    const interactive: any = {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: safeButtons },
    };

    if (options?.headerText) {
      interactive.header = { type: 'text', text: options.headerText };
    }
    if (options?.footerText) {
      interactive.footer = { text: options.footerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'interactive',
      interactive,
    };

    return this.postToMeta(formattedPhone, payload);
  }

  /**
   * Send an interactive list message (for catalogs and more than 3 options)
   */
  public async sendInteractiveList(
    toPhone: string,
    bodyText: string,
    buttonText: string,
    sections: MetaListSection[],
    options?: { title?: string; footerText?: string }
  ): Promise<MetaSendResult> {
    const formattedPhone = this.formatPhone(toPhone);

    let safeBodyText = bodyText;
    if (bodyText.length > 1024) {
      await this.sendTextMessage(formattedPhone, bodyText);
      safeBodyText = '👆 Please select an item from the list below:';
    }

    const interactive: any = {
      type: 'list',
      header: options?.title ? { type: 'text', text: options.title } : undefined,
      body: { text: safeBodyText },
      footer: options?.footerText ? { text: options.footerText } : undefined,
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map((sec) => ({
          title: sec.title.substring(0, 24),
          rows: sec.rows.slice(0, 10).map((r) => ({
            id: r.id.substring(0, 200),
            title: r.title.substring(0, 24),
            description: r.description ? r.description.substring(0, 72) : undefined,
          })),
        })),
      },
    };

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'interactive',
      interactive,
    };

    return this.postToMeta(formattedPhone, payload);
  }

  /**
   * Send an approved WhatsApp Business template message (e.g. for order confirmation outside 24h window)
   */
  public async sendTemplateMessage(
    toPhone: string,
    templateName: string,
    languageCode: string = 'en',
    components?: any[]
  ): Promise<MetaSendResult> {
    const formattedPhone = this.formatPhone(toPhone);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components || [],
      },
    };

    return this.postToMeta(formattedPhone, payload);
  }

  /**
   * Mark an incoming message as read in WhatsApp Cloud API
   */
  public async markMessageAsRead(messageId: string): Promise<boolean> {
    if (!this.isConfigured()) return true;

    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });

      return res.ok;
    } catch (err: any) {
      logger.warn('Failed to mark WhatsApp message as read', { messageId, error: err.message });
      return false;
    }
  }

  /**
   * Dispatches payload to Meta Graph API or logs mock response
   */
  private async postToMeta(toPhone: string, payload: any): Promise<MetaSendResult> {
    if (this.isConfigured()) {
      try {
        const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data: any = await res.json();

        if (!res.ok) {
          const detailMsg = data?.error?.error_data?.details || data?.error?.message || `Meta API HTTP ${res.status}`;
          logger.error('Meta WhatsApp Cloud API error response', {
            status: res.status,
            error: data?.error?.message,
            code: data?.error?.code,
            details: data?.error?.error_data?.details,
          });
          return {
            success: false,
            messageId: '',
            recipientPhone: toPhone,
            mock: false,
            error: detailMsg,
          };
        }

        const providerMsgId = data?.messages?.[0]?.id || `wamid.${crypto.randomBytes(8).toString('hex')}`;
        logger.info('Meta WhatsApp message dispatched successfully', {
          providerMsgId,
          recipientPhone: toPhone,
          type: payload.type,
        });

        return {
          success: true,
          messageId: providerMsgId,
          recipientPhone: toPhone,
          mock: false,
        };
      } catch (err: any) {
        logger.error('Meta WhatsApp Cloud API network dispatch error', {
          recipientPhone: toPhone,
          error: err.message,
        });
        return {
          success: false,
          messageId: '',
          recipientPhone: toPhone,
          mock: false,
          error: err.message,
        };
      }
    }

    // Mock dispatch when WhatsApp Cloud API credentials are not set
    const mockId = `wamid.mock_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    logger.info('[WhatsApp Cloud API Mock Dispatch] Message recorded', {
      providerMsgId: mockId,
      recipientPhone: toPhone,
      type: payload.type,
      preview: payload.type === 'text' ? payload.text?.body?.substring(0, 60) : payload.type,
    });

    return {
      success: true,
      messageId: mockId,
      recipientPhone: toPhone,
      mock: true,
    };
  }

  private formatPhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Retrieves temporary direct download URL for audio/image media from Meta Graph API
   */
  public async getMediaUrl(mediaId: string): Promise<string | null> {
    if (!this.accessToken) {
      logger.info('Meta API token not configured; returning mock media URL', { mediaId });
      return `https://mock.meta.media/${mediaId}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        logger.warn('Failed to resolve Meta media URL', { mediaId, status: res.status });
        return null;
      }

      const json = await res.json() as any;
      return json.url || null;
    } catch (err: any) {
      logger.error('Error fetching Meta media metadata', { mediaId, error: err.message });
      return null;
    }
  }

  /**
   * Downloads raw binary buffer of an audio or image file from Meta Content Delivery Network
   */
  public async downloadMediaBuffer(mediaUrl: string): Promise<Buffer | null> {
    if (!mediaUrl || mediaUrl.startsWith('https://mock')) {
      logger.warn('No valid Meta media URL available for download');
      return null;
    }

    try {
      const res = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        logger.warn('Failed to download Meta media binary', { status: res.status });
        return null;
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err: any) {
      logger.error('Error downloading Meta media binary', { error: err.message });
      return null;
    }
  }
}

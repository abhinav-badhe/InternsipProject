import express, { Request, Response, NextFunction } from 'express';
import { WhatsAppBot, CatalogClient, PricingClient, OrderClient } from './whatsapp.bot.js';
import { WhatsAppCloudApiClient } from './meta.client.js';
import { SignatureVerifier } from './signature.verifier.js';
import { Database } from './db.js';
import {
  createLogger,
  generateCorrelationId,
  runWithContext,
  getRequestContext,
} from '@grocery/observability';
import { okResponse, errorResponse } from '@grocery/contracts';

const logger = createLogger('whatsapp-adapter:api');

export function createApp(deps?: {
  catalogClient?: CatalogClient;
  pricingClient?: PricingClient;
  orderClient?: OrderClient;
  metaClient?: WhatsAppCloudApiClient;
}): express.Application {
  const app = express();

  // Raw body capture for cryptographic webhook HMAC verification
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'whatsapp-adapter',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    });
  });

  const catalogClient: CatalogClient = deps?.catalogClient || {
    disambiguate: async (term) => {
      const res = await fetch(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/disambiguate?term=${encodeURIComponent(term)}`
      );
      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Order creation failed (${res.status})`);
      }
      return json.data;
    },
    searchProducts: async (query, categoryId) => {
      const url = new URL(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/products`
      );
      if (query) url.searchParams.set('query', query);
      if (categoryId) url.searchParams.set('categoryId', categoryId);
      const res = await fetch(url.toString());
      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Order creation failed (${res.status})`);
      }
      return json.data;
    },
    getSimilarAlternatives: async (sku) => {
      const res = await fetch(
        `${process.env.CATALOG_SERVICE_URL || 'http://localhost:3001'}/api/v1/catalog/variants/${sku}/alternatives`
      );
      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Order creation failed (${res.status})`);
      }
      return json.data;
    },
  };

  const pricingClient: PricingClient = deps?.pricingClient || {
    calculateQuote: async (items) => {
      const res = await fetch(
        `${process.env.PRICING_SERVICE_URL || 'http://localhost:3002'}/api/v1/pricing/quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }
      );
      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Order creation failed (${res.status})`);
      }
      return json.data;
    },
  };

  const orderClient: OrderClient = deps?.orderClient || {
    checkout: async (req) => {
      const res = await fetch(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:3004'}/api/v1/orders/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        }
      );
      const json: any = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || `Order creation failed (${res.status})`);
      }
      return json.data;
    },
  };

  const metaClient: WhatsAppCloudApiClient = deps?.metaClient || new WhatsAppCloudApiClient();

  const bot = new WhatsAppBot(catalogClient, pricingClient, orderClient, metaClient);

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || generateCorrelationId();
    res.setHeader('X-Correlation-Id', correlationId);

    runWithContext(
      {
        correlationId,
        serviceName: 'whatsapp-adapter',
        route: `${req.method} ${req.path}`,
      },
      () => {
        logger.info('Incoming WhatsApp adapter request', { method: req.method, path: req.path });
        next();
      }
    );
  });

  // Health checks
  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    const isDbHealthy = await Database.checkHealth();
    if (isDbHealthy) {
      res.status(200).json({
        status: 'ready',
        database: 'connected',
        metaConfigured: metaClient.isConfigured(),
      });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Meta Webhook Verification Handshake (GET /webhook/whatsapp or /api/v1/whatsapp/webhook)
  const webhookHandshakeHandler = (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken =
      process.env.WHATSAPP_VERIFY_TOKEN ||
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
      process.env.VERIFY_TOKEN ||
      'test_verify_token';

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('Meta webhook verification handshake successful');
      return res.status(200).send(challenge);
    }

    logger.warn('Meta webhook verification handshake failed: Token mismatch');
    return res.status(403).send('Forbidden');
  };

  app.get('/webhook/whatsapp', webhookHandshakeHandler);
  app.get('/api/v1/whatsapp/webhook', webhookHandshakeHandler);

  // Meta Webhook Inbound Message Receiver (POST /webhook/whatsapp or /api/v1/whatsapp/webhook)
  const webhookMessageHandler = async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';

    // 1. Verify HMAC signature if app secret is set
    const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
      const isValid = SignatureVerifier.verifyMetaSignature(rawBody, signature, appSecret);

      if (!isValid) {
        logger.warn('Forged WhatsApp webhook rejected: Invalid HMAC signature');
        return res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid signature', correlationId));
      }
    }

    const isSync = req.query.sync === 'true' || req.headers['x-sync-response'] === 'true';

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      // Handle delivery status update webhooks (sent, delivered, read, failed)
      if (value?.statuses && value.statuses.length > 0) {
        for (const st of value.statuses) {
          logger.info('WhatsApp message delivery status update', {
            status: st.status,
            messageId: st.id,
            recipientId: st.recipient_id,
          });
        }
        return res.status(200).send('EVENT_RECEIVED');
      }

      // Handle inbound message
      const message = value?.messages?.[0];
      if (message) {
        const fromPhone = message.from;
        const messageId = message.id;

        // Extract message content across all Meta payload variations:
        // text, interactive button reply, interactive list reply, quick reply button
        const text =
          message.text?.body ||
          message.interactive?.button_reply?.id ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.id ||
          message.interactive?.list_reply?.title ||
          message.button?.payload ||
          message.button?.text ||
          '';

        // Mark incoming message as read in Meta
        await metaClient.markMessageAsRead(messageId).catch(() => {});

        // Process message through bot (bot automatically dispatches reply via Meta Cloud API)
        const reply = await bot.handleInboundMessage({
          messageId,
          fromPhoneNumber: fromPhone,
          text,
          timestamp: message.timestamp || Math.floor(Date.now() / 1000).toString(),
        });

        if (isSync) {
          const session = await bot.getSession(fromPhone);
          return res.status(200).json(okResponse({ outboundMessage: reply, session }, correlationId));
        }
      }

      // Default Meta async acknowledgment (must respond promptly with HTTP 200)
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err: any) {
      logger.error('Error processing WhatsApp message', { error: err.message });
      if (isSync) {
        return res.status(500).json(errorResponse('PROCESSING_ERROR', err.message, correlationId));
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
  };

  app.post('/webhook/whatsapp', webhookMessageHandler);
  app.post('/api/v1/whatsapp/webhook', webhookMessageHandler);

  // Direct Interactive Chat Endpoint (for Store Simulator & E2E verification)
  const chatHandler = async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const message = req.body?.message ?? req.body?.text ?? '';
    const phoneNumber = req.body?.phoneNumber || req.body?.fromPhone || req.body?.fromPhoneNumber || '+919876543210';
    const messageId = req.body?.messageId || `sim_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const reply = await bot.handleInboundMessage({
        messageId,
        fromPhoneNumber: phoneNumber,
        text: message,
        timestamp: Math.floor(Date.now() / 1000).toString(),
      });

      const session = await bot.getSession(phoneNumber);

      return res.status(200).json(
        okResponse(
          {
            messageId,
            reply: reply?.bodyText || null,
            outboundMessage: reply,
            session,
          },
          correlationId
        )
      );
    } catch (err: any) {
      logger.error('Error in WhatsApp chat simulator handler', { error: err.message });
      return res.status(500).json(errorResponse('CHAT_ERROR', err.message, correlationId));
    }
  };

  app.post('/api/v1/whatsapp/chat', chatHandler);
  app.post('/webhook/whatsapp/chat', chatHandler);

  // Shopkeeper Sending Billing Invoice to Customer via WhatsApp Commerce
  app.post('/api/v1/whatsapp/send-invoice', async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const {
      orderNumber,
      customerPhone,
      customerName,
      invoiceNumber,
      items,
      subtotal,
      taxTotal,
      deliveryFee,
      grandTotal,
      paymentCheckoutUrl,
    } = req.body;

    if (!customerPhone || !orderNumber) {
      return res
        .status(400)
        .json(errorResponse('VALIDATION_ERROR', 'customerPhone and orderNumber are required', correlationId));
    }

    const cleanPhone = customerPhone.startsWith('+') ? customerPhone : `+${customerPhone.replace(/[^0-9]/g, '')}`;
    const invNum = invoiceNumber || `INV-${new Date().getUTCFullYear()}-${orderNumber.slice(-6)}`;
    const custName = customerName || 'Valued Customer';
    const itemsList = Array.isArray(items) ? items : [];

    let billText = `🧾 *FreshCart Tax Invoice & Order Receipt*\n`;
    billText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    billText += `🆔 *Invoice #:* *${invNum}*\n`;
    billText += `📦 *Order #:* *${orderNumber}*\n`;
    billText += `👤 *Billed To:* ${custName}\n`;
    billText += `📱 *Customer Phone:* ${cleanPhone}\n`;
    billText += `📅 *Date:* ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n\n`;

    if (itemsList.length > 0) {
      billText += `📋 *Items Breakdown (${itemsList.length} items):*\n`;
      itemsList.forEach((it: any, idx: number) => {
        const title = it.productName || it.name || it.description || 'Item';
        const qty = it.quantity || it.qty || 1;
        const lineTotal = Number(it.netAmount || it.amount || (Number(it.unitPrice || it.rate || 0) * qty));
        billText += `${idx + 1}. *${title}* ${it.variantName ? `(${it.variantName})` : ''} × ${qty} — ₹${lineTotal.toFixed(2)}\n`;
      });
      billText += `\n`;
    }

    const sub = Number(subtotal || grandTotal || 0);
    const tax = Number(taxTotal || 0);
    const fee = Number(deliveryFee || 0);
    const grand = Number(grandTotal || sub + tax + fee);

    billText += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    billText += `*Taxable Subtotal:* ₹${sub.toFixed(2)}\n`;
    if (tax > 0) {
      billText += `*GST (CGST + SGST):* ₹${tax.toFixed(2)}\n`;
    }
    if (fee > 0) {
      billText += `*Delivery Fee:* ₹${fee.toFixed(2)}\n`;
    }
    billText += `*Grand Total:* *₹${grand.toFixed(2)}*\n`;
    billText += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    billText += `🛵 *Order Status:* Confirmed & Assigned to Dark Store Packaging!\n`;
    if (paymentCheckoutUrl) {
      billText += `💳 *Digital Invoice & Payment Link:*\n${paymentCheckoutUrl}\n\n`;
    }
    billText += `Thank you for shopping with FreshCart! Reply with *'Track'* anytime to check delivery status.`;

    try {
      const dispatchResult = await metaClient.sendTextMessage(cleanPhone, billText);

      // Log to conversation history
      const session = await bot.getOrCreateSession(cleanPhone);
      await (bot as any).logConversation(session.sessionId, 'OUTBOUND', 'text', billText, {
        invoiceNumber: invNum,
        orderNumber,
        grandTotal: grand,
      });

      return res.status(200).json(
        okResponse(
          {
            success: true,
            invoiceNumber: invNum,
            recipientPhone: cleanPhone,
            messageText: billText,
            dispatchResult,
          },
          correlationId
        )
      );
    } catch (err: any) {
      return res.status(500).json(errorResponse('DISPATCH_ERROR', err.message, correlationId));
    }
  });

  // Proactive Outbound Message Dispatch API (for notifications & system alerts)
  app.post(['/api/v1/whatsapp/messages/send', '/api/v1/whatsapp/dispatch'], async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const rawPhone = req.body.toPhone || req.body.toPhoneNumber || req.body.phone || req.body.recipientAddress;
    const bodyText = req.body.bodyText || req.body.text || req.body.message;
    const type = req.body.type;
    const options = req.body.options || req.body.buttons;
    const templateName = req.body.templateName;

    if (!rawPhone) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing toPhone / phone', correlationId));
    }

    const cleanPhone = String(rawPhone).startsWith('+') ? String(rawPhone) : `+${String(rawPhone).replace(/[^0-9]/g, '')}`;

    try {
      let dispatchResult;
      if (type === 'template' && templateName) {
        dispatchResult = await metaClient.sendTemplateMessage(cleanPhone, templateName, 'en', options);
      } else if ((type === 'buttons' || Array.isArray(options)) && options && options.length > 0) {
        dispatchResult = await metaClient.sendInteractiveButtons(cleanPhone, bodyText || '', options);
      } else {
        dispatchResult = await metaClient.sendTextMessage(cleanPhone, bodyText || '');
      }

      // Log outbound message to conversation history & session
      try {
        const session = await bot.getOrCreateSession(cleanPhone);
        await (bot as any).logConversation(
          session.sessionId,
          'OUTBOUND',
          options && options.length > 0 ? 'interactive' : 'text',
          bodyText || '',
          { correlationId, options }
        );
        // Also extract order number if present in text and link to session
        const orderMatch = (bodyText || '').match(/ORD-[\w-]+/i);
        if (orderMatch) {
          (session as any).lastOrderNumber = orderMatch[0].toUpperCase();
          await (bot as any).saveSession(session);
        }
      } catch (logErr: any) {
        logger.warn('Failed to log outbound dispatch to conversation history', { error: logErr.message });
      }

      return res.status(200).json(okResponse(dispatchResult, correlationId));
    } catch (err: any) {
      return res.status(500).json(errorResponse('DISPATCH_ERROR', err.message, correlationId));
    }
  });

  // Session & Conversation History Viewer (GET /api/v1/whatsapp/sessions/:phone)
  app.get('/api/v1/whatsapp/sessions/:phone', async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const phone = String(req.params.phone);

    try {
      const session = await bot.getSession(phone);
      let history: any[] = [];

      if (session) {
        const historyRes = await Database.query(
          `SELECT id, direction, message_type, content, metadata, created_at
           FROM whatsapp_conversation_history
           WHERE session_id = $1
           ORDER BY created_at ASC`,
          [session.sessionId]
        );
        history = historyRes.rows;
      }

      return res.status(200).json(
        okResponse(
          {
            session,
            history,
          },
          correlationId
        )
      );
    } catch (err: any) {
      return res.status(500).json(errorResponse('DB_ERROR', err.message, correlationId));
    }
  });

  // Session Reset (POST /api/v1/whatsapp/sessions/:phone/reset)
  app.post('/api/v1/whatsapp/sessions/:phone/reset', async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const phone = String(req.params.phone);

    try {
      await Database.query(`DELETE FROM whatsapp_sessions WHERE phone_number = $1`, [phone]);
      return res.status(200).json(okResponse({ reset: true, phone }, correlationId));
    } catch (err: any) {
      return res.status(500).json(errorResponse('DB_ERROR', err.message, correlationId));
    }
  });

  // Restock Notification Trigger (POST /api/v1/whatsapp/restock-notify)
  app.post('/api/v1/whatsapp/restock-notify', async (req: Request, res: Response) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    const { sku, availableStock } = req.body;

    if (!sku) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing sku', correlationId));
    }

    try {
      const notifiedCount = await bot.notifyBackInStock(sku, Number(availableStock) || 1);
      return res.status(200).json(okResponse({ sku, notifiedCount }, correlationId));
    } catch (err: any) {
      logger.error('Failed to dispatch back-in-stock notifications', { sku, error: err.message });
      return res.status(500).json(errorResponse('RESTOCK_NOTIFY_ERROR', err.message, correlationId));
    }
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const correlationId = getRequestContext()?.correlationId || 'unknown';
    logger.error('Unhandled WhatsApp adapter exception', { error: err.message });
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
  });

  return app;
}

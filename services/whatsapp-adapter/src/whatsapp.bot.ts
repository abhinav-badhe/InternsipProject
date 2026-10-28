import { Database } from './db.js';
import {
  CategoryDisambiguationResult,
  CreateOrderRequest,
  OrderResponse,
  QuoteResponse,
  SimilarProductSuggestion,
  WhatsAppInboundMessage,
  WhatsAppOutboundMessage,
  WhatsAppSessionState,
} from '@grocery/contracts';
import { createLogger } from '@grocery/observability';
import crypto from 'node:crypto';

const logger = createLogger('whatsapp-adapter:bot');

export interface CatalogClient {
  disambiguate(term: string): Promise<CategoryDisambiguationResult>;
  searchProducts(query?: string, categoryId?: string): Promise<any>;
  getSimilarAlternatives(sku: string): Promise<SimilarProductSuggestion | null>;
}

export interface PricingClient {
  calculateQuote(items: Array<{ sku: string; quantity: number }>): Promise<QuoteResponse>;
}

export interface OrderClient {
  checkout(req: CreateOrderRequest): Promise<OrderResponse>;
}

export class WhatsAppBot {
  constructor(
    private readonly catalogClient: CatalogClient,
    private readonly pricingClient: PricingClient,
    private readonly orderClient: OrderClient
  ) {}

  /**
   * Main entry point to process an inbound WhatsApp message
   */
  public async handleInboundMessage(msg: WhatsAppInboundMessage): Promise<WhatsAppOutboundMessage | null> {
    // 1. DEDUPLICATION GATE (Acceptance Scenario 8)
    const isNewMessage = await this.deduplicateMessage(msg.messageId, msg.fromPhoneNumber);
    if (!isNewMessage) {
      logger.info('Duplicate WhatsApp webhook ignored', { messageId: msg.messageId });
      return null;
    }

    // 2. RETRIEVE OR INITIALIZE SESSION
    const session = await this.getOrCreateSession(msg.fromPhoneNumber);
    const text = msg.text.trim();
    const lowerText = text.toLowerCase();

    // 3. HUMAN SUPPORT HANDOFF
    if (lowerText === 'human' || lowerText === 'agent' || lowerText === 'support' || lowerText === 'help') {
      return {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText:
          'Connecting you with our store support staff. 👤 A customer service representative will reply shortly.',
      };
    }

    // 4. SUBSTITUTION RESPONSE (Acceptance Scenario 10)
    if (session.stage === 'AWAITING_SUBSTITUTION_APPROVAL' && session.pendingSubstitution) {
      if (lowerText.includes('accept') || lowerText === '1' || lowerText === 'yes') {
        const sub = session.pendingSubstitution;
        session.stage = 'IDLE';
        session.pendingSubstitution = undefined;
        await this.saveSession(session);

        return {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `✅ Substitution approved! We have replaced ${sub.originalProductName} with ${sub.proposedProductName}. Your order is now packing! 🛵`,
        };
      } else if (lowerText.includes('reject') || lowerText === '2' || lowerText === 'no') {
        const sub = session.pendingSubstitution;
        session.stage = 'IDLE';
        session.pendingSubstitution = undefined;
        await this.saveSession(session);

        return {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `Item ${sub.originalProductName} removed from order. A refund for this item will be credited to your original payment method.`,
        };
      }
    }

    // 5. STAGE: DISAMBIGUATING CATEGORY (Acceptance Scenario 9: e.g. user selected 1, 2, or 3 for "soap")
    if (session.stage === 'DISAMBIGUATING_CATEGORY' && session.pendingDisambiguation) {
      const selectionIndex = parseInt(text, 10) - 1;
      const matched = session.pendingDisambiguation.matchedCategories[selectionIndex];

      if (matched) {
        session.stage = 'IDLE';
        session.pendingDisambiguation = undefined;
        await this.saveSession(session);

        // Fetch products in that chosen category
        const searchRes = await this.catalogClient.searchProducts(undefined, matched.id);
        const products = searchRes.items || [];

        let reply = `Here are our top **${matched.name}**:\n\n`;
        products.slice(0, 3).forEach((p: any, idx: number) => {
          reply += `${idx + 1}. **${p.name}**\n`;
          p.variants.forEach((v: any, vIdx: number) => {
            reply += `   • Option ${String.fromCharCode(65 + vIdx)}: ${v.variantName} (SKU: ${v.sku})\n`;
          });
        });
        reply += `\nReply with the SKU or item name to add it to your cart.`;

        return {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: reply,
        };
      }
    }

    // 6. CHECKOUT / CONFIRMATION
    if (lowerText === 'confirm' || lowerText === 'checkout' || lowerText === 'pay') {
      if (session.cartItems.length === 0) {
        return {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: 'Your cart is currently empty. Tell me what items you need!',
        };
      }

      // Calculate server-side price quote
      const quote = await this.pricingClient.calculateQuote(
        session.cartItems.map((i) => ({ sku: i.sku, quantity: i.quantity }))
      );

      // Trigger order checkout saga with idempotency key
      const idempotencyKey = `whatsapp-order-${msg.messageId}`;
      const order = await this.orderClient.checkout({
        idempotencyKey,
        channel: 'WHATSAPP',
        customerId: session.customerId || `phone_${msg.fromPhoneNumber}`,
        deliveryAddress: {
          recipientName: 'WhatsApp Customer',
          phone: msg.fromPhoneNumber,
          addressLine1: 'Customer WhatsApp Address',
          city: 'Local',
          postalCode: '560001',
        },
        items: session.cartItems.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      });

      // Clear cart on successful order creation
      session.cartItems = [];
      session.stage = 'IDLE';
      await this.saveSession(session);

      return {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText:
          `✅ **Order ${order.orderNumber} placed!**\n\n` +
          `Subtotal: ₹${quote.subtotal.toFixed(2)}\n` +
          `GST Tax: ₹${quote.taxTotal.toFixed(2)}\n` +
          `Delivery: ₹${quote.deliveryFee.toFixed(2)}\n` +
          `*Grand Total: ₹${quote.grandTotal.toFixed(2)}*\n\n` +
          `Please tap the link below to pay securely:\n` +
          `🔗 ${order.paymentCheckoutUrl}`,
      };
    }

    // 7. CHECK FOR CATEGORY DISAMBIGUATION (Acceptance Scenario 9)
    const disambiguation = await this.catalogClient.disambiguate(text);
    if (disambiguation.isAmbiguous) {
      session.stage = 'DISAMBIGUATING_CATEGORY';
      session.pendingDisambiguation = {
        query: text,
        matchedCategories: disambiguation.matchingCategories.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      };
      await this.saveSession(session);

      let prompt = `We have different types of ${text}. Which one are you looking for?\n\n`;
      disambiguation.matchingCategories.forEach((cat, idx) => {
        const brands = cat.sampleBrands.length > 0 ? ` (${cat.sampleBrands.join(', ')})` : '';
        prompt += `${idx + 1}️⃣ **${cat.name}**${brands}\n`;
      });
      prompt += `\n*(Reply with 1, 2, or 3)*`;

      return {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText: prompt,
      };
    }

    // 8. GENERAL PRODUCT SEARCH & CART ADDITION
    const searchRes = await this.catalogClient.searchProducts(text);
    if (searchRes.items && searchRes.items.length > 0) {
      const topProduct = searchRes.items[0];
      const variant = topProduct.variants[0];

      // Add to session cart
      session.cartItems.push({
        sku: variant.sku,
        productName: topProduct.name,
        variantName: variant.variantName,
        quantity: 1,
        unitPrice: 0, // Server quote recalculates price
      });
      await this.saveSession(session);

      return {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText:
          `Added **${topProduct.name} (${variant.variantName})** to your cart! 🛒\n\n` +
          `Current items: ${session.cartItems.length}\n` +
          `Reply with more items, or type **'Confirm'** to proceed to payment.`,
      };
    }

    return {
      toPhoneNumber: msg.fromPhoneNumber,
      type: 'text',
      bodyText: `I couldn't find "${text}" in our catalog. Could you please specify the brand or item name?`,
    };
  }

  /**
   * Deduplicate message by provider message ID (Acceptance Scenario 8)
   */
  private async deduplicateMessage(messageId: string, phone: string): Promise<boolean> {
    try {
      await Database.query(
        `INSERT INTO whatsapp_processed_messages (message_id, from_phone)
         VALUES ($1, $2)`,
        [messageId, phone]
      );
      return true;
    } catch (err: any) {
      // Primary key conflict means message was already processed
      if (err.code === '23505') {
        return false;
      }
      throw err;
    }
  }

  private async getOrCreateSession(phone: string): Promise<WhatsAppSessionState> {
    const res = await Database.query(
      `SELECT session_id, phone_number, customer_id, stage, cart_items, pending_context, last_message_at
       FROM whatsapp_sessions
       WHERE phone_number = $1
       LIMIT 1`,
      [phone]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        sessionId: row.session_id,
        phoneNumber: row.phone_number,
        customerId: row.customer_id,
        stage: row.stage,
        cartItems: row.cart_items || [],
        pendingDisambiguation: row.pending_context?.pendingDisambiguation,
        pendingSubstitution: row.pending_context?.pendingSubstitution,
        lastMessageAt: row.last_message_at,
      };
    }

    const sessionId = crypto.randomUUID();
    const newSession: WhatsAppSessionState = {
      sessionId,
      phoneNumber: phone,
      stage: 'IDLE',
      cartItems: [],
      lastMessageAt: new Date().toISOString(),
    };

    await Database.query(
      `INSERT INTO whatsapp_sessions (session_id, phone_number, stage, cart_items)
       VALUES ($1, $2, 'IDLE', '[]'::JSONB)`,
      [sessionId, phone]
    );

    return newSession;
  }

  private async saveSession(session: WhatsAppSessionState): Promise<void> {
    await Database.query(
      `UPDATE whatsapp_sessions 
       SET stage = $1, cart_items = $2, pending_context = $3, last_message_at = NOW()
       WHERE session_id = $4`,
      [
        session.stage,
        JSON.stringify(session.cartItems),
        JSON.stringify({
          pendingDisambiguation: session.pendingDisambiguation,
          pendingSubstitution: session.pendingSubstitution,
        }),
        session.sessionId,
      ]
    );
  }
}

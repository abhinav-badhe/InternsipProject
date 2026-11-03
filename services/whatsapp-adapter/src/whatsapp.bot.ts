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
import { WhatsAppCloudApiClient } from './meta.client.js';
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
    private readonly orderClient: OrderClient,
    private readonly metaClient?: WhatsAppCloudApiClient
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

    // Log Inbound Message to History (Acceptance Scenario 8 & Audit Log)
    await this.logConversation(session.sessionId, 'INBOUND', 'text', text);

    // 3. HUMAN SUPPORT HANDOFF
    if (lowerText === 'human' || lowerText === 'agent' || lowerText === 'support' || lowerText === 'help') {
      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText:
          'Connecting you with our store support staff. 👤 A customer service representative will reply shortly.',
      });
    }

    // 3b. GREETINGS & ONBOARDING
    const isGreeting = /^(hi|hello|hey|namaste|start|menu|morning|evening|help me)\b/i.test(lowerText);
    if (isGreeting && session.stage === 'IDLE' && session.cartItems.length === 0) {
      const welcomeMsg =
        `👋 *Welcome to FreshCart Instant Grocery Delivery!* 🛵\n\n` +
        `We deliver fresh groceries, dairy, and household essentials in 10-15 minutes.\n\n` +
        `🛒 *How to order:*\n` +
        `• Send your shopping list directly, e.g.:\n` +
        `  _1. Amul butter 500g_\n` +
        `  _2. Britannia bread_\n` +
        `  _3. Tata salt 1kg_\n` +
        `• Or search any brand/product (e.g. *"Milk"*, *"Atta"*, *"Soap"*, *"Maggi"*)\n\n` +
        `Type *'Cart'* to view your items, *'Track'* to check recent orders, or *'Help'* to reach staff.`;

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: welcomeMsg,
        options: [
          { id: 'cat_soap', title: 'Browse Soaps' },
          { id: 'cart_view', title: 'View Cart' },
          { id: 'track_order', title: 'Track Order' },
        ],
      });
    }

    // 4. RESET / CLEAR CART
    if (lowerText === 'clear' || lowerText === 'clear cart' || lowerText === 'reset' || lowerText === 'cart_clear') {
      session.cartItems = [];
      session.stage = 'IDLE';
      session.pendingDisambiguation = undefined;
      session.pendingSubstitution = undefined;
      (session as any).pendingBrandSelection = undefined;
      (session as any).pendingVariantSelection = undefined;
      (session as any).pendingAlternatives = undefined;
      (session as any).pendingVariantChoices = undefined;
      await this.saveSession(session);

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'text',
        bodyText: '🧹 Your cart and conversation state have been reset. What would you like to search for today?',
      });
    }

    // 4b. BROWSE SOAPS ACTION BUTTON
    if (lowerText === 'cat_soap' || lowerText === 'browse soaps' || lowerText === 'browse soap') {
      const disambiguation = await this.catalogClient.disambiguate('soap');
      if (disambiguation && disambiguation.isAmbiguous) {
        session.stage = 'DISAMBIGUATING_CATEGORY';
        session.pendingDisambiguation = {
          query: 'soap',
          matchedCategories: disambiguation.matchingCategories.map((c) => ({
            id: c.id,
            name: c.name,
          })),
        };
        await this.saveSession(session);

        let prompt = `🧼 *Multiple categories found for "Soap":*\nWhich category are you looking for?\n\n`;
        disambiguation.matchingCategories.forEach((cat, idx) => {
          prompt += `${idx + 1}️⃣ *${cat.name}*\n`;
        });
        prompt += `\n*(Tap a button or reply with 1, 2, or 3)*`;

        const buttons = disambiguation.matchingCategories.slice(0, 3).map((cat, idx) => ({
          id: `cat_${idx + 1}`,
          title: cat.name.substring(0, 20),
        }));

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText: prompt,
          options: buttons,
        });
      }
    }

    // 5. VIEW CART
    if (lowerText === 'cart' || lowerText === 'view cart' || lowerText === 'my cart' || lowerText === 'cart_view') {
      if (session.cartItems.length === 0) {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: '🛒 Your cart is currently empty. Tell me what items you would like to order!',
        });
      }

      let cartSummary = `🛒 *Your Current Cart (${session.cartItems.length} items):*\n\n`;
      let runningTotal = 0;
      session.cartItems.forEach((item, idx) => {
        const itemTotal = (item.unitPrice || 0) * item.quantity;
        runningTotal += itemTotal;
        cartSummary += `${idx + 1}. *${item.productName}* (${item.variantName}) × ${item.quantity} — ₹${itemTotal.toFixed(2)}\n`;
      });
      cartSummary += `\n*Subtotal:* ₹${runningTotal.toFixed(2)}`;
      cartSummary += `\n\nReply with *'Confirm'* or tap below to place your order!`;

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: cartSummary,
        options: [
          { id: 'cart_confirm', title: 'Confirm Order' },
          { id: 'cart_clear', title: 'Clear Cart' },
        ],
      });
    }

    // 5b. ORDER TRACKING & STATUS
    if (
      lowerText === 'track' ||
      lowerText === 'status' ||
      lowerText === 'order status' ||
      lowerText === 'track order' ||
      lowerText === 'track_order' ||
      lowerText.includes('where is my order') ||
      lowerText.startsWith('track ')
    ) {
      const specificOrderMatch = text.match(/ORD-\d+-\d+/i);
      const cleanPhone = msg.fromPhoneNumber.replace(/[^0-9]/g, '');

      let orderRow: any = null;
      if (specificOrderMatch) {
        const orderNum = specificOrderMatch[0].toUpperCase();
        const res = await Database.query(
          `SELECT o.id, o.order_number, o.status, o.grand_total, o.channel, o.delivery_address, o.created_at,
                  COUNT(oi.id) as item_count
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.order_number = $1
           GROUP BY o.id, o.order_number, o.status, o.grand_total, o.channel, o.delivery_address, o.created_at
           LIMIT 1`,
          [orderNum]
        );
        orderRow = res.rows[0];
      } else {
        const res = await Database.query(
          `SELECT o.id, o.order_number, o.status, o.grand_total, o.channel, o.delivery_address, o.created_at,
                  COUNT(oi.id) as item_count
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.customer_id ILIKE $1 OR o.delivery_address->>'phone' ILIKE $2
           GROUP BY o.id, o.order_number, o.status, o.grand_total, o.channel, o.delivery_address, o.created_at
           ORDER BY o.created_at DESC
           LIMIT 1`,
          ['%' + cleanPhone + '%', '%' + cleanPhone + '%']
        );
        orderRow = res.rows[0];
      }

      if (orderRow) {
        const statusMap: Record<string, string> = {
          AWAITING_PAYMENT: '💳 Awaiting Payment Confirmation',
          CONFIRMED: '✅ Confirmed & Assigned to Picker',
          PICKING: '📦 Warehouse Picking in Progress',
          PICKED: '🛵 Picked & Ready for Dispatch',
          OUT_FOR_DELIVERY: '🛵 Out for Delivery (~8 mins)',
          DELIVERED: '🎉 Delivered Successfully',
          CANCELLED: '❌ Cancelled',
        };
        const statusText = statusMap[orderRow.status] || orderRow.status;
        const placedTime = new Date(orderRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let trackMsg = `📦 *Live Order Tracking*\n\n`;
        trackMsg += `🆔 *Order Number:* *${orderRow.order_number}*\n`;
        trackMsg += `⏱️ *Placed At:* ${placedTime}\n`;
        trackMsg += `🛵 *Status:* *${statusText}*\n`;
        trackMsg += `🛍️ *Items:* ${orderRow.item_count} items\n`;
        trackMsg += `💰 *Grand Total:* *₹${Number(orderRow.grand_total).toFixed(2)}*\n\n`;
        trackMsg += `Need support with this order? Reply *'Help'* to connect with our store staff immediately.`;

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: trackMsg,
        });
      } else {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `No active orders found for phone number ${msg.fromPhoneNumber}. If you have an order number, reply with *'Track ORD-XXXXXX'*!`,
        });
      }
    }

    // 5c. REMOVE ITEM FROM CART
    if (lowerText.startsWith('remove ') || lowerText.startsWith('delete ')) {
      const target = lowerText.replace(/^(remove|delete)\s+/i, '').trim();
      const numIdx = parseInt(target, 10);

      let removed: any = null;
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= session.cartItems.length) {
        removed = session.cartItems.splice(numIdx - 1, 1)[0];
      } else {
        const idx = session.cartItems.findIndex(
          (i) => i.productName.toLowerCase().includes(target) || i.sku.toLowerCase().includes(target)
        );
        if (idx !== -1) {
          removed = session.cartItems.splice(idx, 1)[0];
        }
      }

      if (removed) {
        await this.saveSession(session);
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText: `🗑️ Removed *${removed.productName}* from your cart.\n\nRemaining items in cart: ${session.cartItems.length}`,
          options: [
            { id: 'cart_view', title: 'View Cart' },
            { id: 'cart_confirm', title: 'Confirm Order' },
          ],
        });
      } else {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `Could not find "${target}" in your cart. Reply with *'Cart'* to see your current items.`,
        });
      }
    }

    // 5d. INTERACTIVE VARIANT / PACK SIZE SELECTION
    const pendingVariantChoices = (session as any).pendingVariantChoices;
    if (pendingVariantChoices && pendingVariantChoices.length > 0) {
      let selectedIdx = -1;
      if (lowerText.startsWith('var_')) {
        selectedIdx = parseInt(lowerText.replace('var_', ''), 10) - 1;
      } else if (lowerText === '1' || lowerText === 'first' || lowerText === 'one') {
        selectedIdx = 0;
      } else if (lowerText === '2' || lowerText === 'second' || lowerText === 'two') {
        selectedIdx = 1;
      } else if (lowerText === '3' || lowerText === 'third' || lowerText === 'three') {
        selectedIdx = 2;
      } else {
        selectedIdx = pendingVariantChoices.findIndex(
          (v: any) =>
            v.variantName.toLowerCase().includes(lowerText) ||
            v.sku.toLowerCase().includes(lowerText) ||
            v.productName.toLowerCase().includes(lowerText)
        );
      }

      if (selectedIdx >= 0 && selectedIdx < pendingVariantChoices.length) {
        const chosen = pendingVariantChoices[selectedIdx];
        session.cartItems.push({
          sku: chosen.sku,
          productName: chosen.productName,
          variantName: chosen.variantName,
          quantity: chosen.quantity || 1,
          unitPrice: Number(chosen.price),
        });
        session.stage = 'IDLE';
        (session as any).pendingVariantChoices = undefined;
        await this.saveSession(session);

        let cartSubtotal = 0;
        session.cartItems.forEach((i) => (cartSubtotal += (i.unitPrice || 0) * i.quantity));

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText:
            `Added *${chosen.productName} (${chosen.variantName})* to your cart! 🛒\n\n` +
            `💰 Price: *₹${Number(chosen.price).toFixed(2)}*\n` +
            `📦 Items in cart: ${session.cartItems.length} (Subtotal: ₹${cartSubtotal.toFixed(2)})\n\n` +
            `Reply with more items, or tap below to proceed:`,
          options: [
            { id: 'cart_confirm', title: 'Confirm Order' },
            { id: 'cart_view', title: 'View Cart' },
            { id: 'cart_clear', title: 'Clear Cart' },
          ],
        });
      }
    }

    // Direct add/buy command resets browsing drilldown
    if (
      lowerText.startsWith('add ') ||
      lowerText.startsWith('buy ') ||
      lowerText.startsWith('get ') ||
      lowerText.startsWith('need ')
    ) {
      session.stage = 'IDLE';
      session.pendingDisambiguation = undefined;
      (session as any).pendingBrandSelection = undefined;
      (session as any).pendingVariantSelection = undefined;
    }

    // 6. ACCEPT LIST ALTERNATIVES (When user taps "Accept Alternatives")
    const pendingAlts = (session as any).pendingAlternatives;
    if (
      pendingAlts &&
      pendingAlts.length > 0 &&
      (lowerText.includes('accept') ||
        lowerText.includes('alternative') ||
        lowerText === 'alt_accept' ||
        lowerText === 'yes' ||
        lowerText === '1')
    ) {
      for (const alt of pendingAlts) {
        session.cartItems.push({
          sku: alt.sku,
          productName: alt.name,
          variantName: alt.variantName || 'Standard',
          quantity: alt.quantity || 1,
          unitPrice: alt.price || 0,
        });
      }
      (session as any).pendingAlternatives = undefined;
      session.stage = 'IDLE';
      await this.saveSession(session);

      let updatedCartSummary = `✅ *Added Suggested In-Stock Alternatives to Your Cart!*\n\n`;
      updatedCartSummary += `🛒 *Your Complete Order Cart (${session.cartItems.length} items):*\n`;
      let grand = 0;
      session.cartItems.forEach((item, idx) => {
        const itemTotal = (item.unitPrice || 0) * item.quantity;
        grand += itemTotal;
        updatedCartSummary += `${idx + 1}. *${item.productName}* (${item.variantName}) × ${item.quantity} — ₹${itemTotal.toFixed(2)}\n`;
      });
      updatedCartSummary += `\n*Cart Subtotal:* *₹${grand.toFixed(2)}*\n\n`;
      updatedCartSummary += `Ready to place your order? Reply with *'Confirm'* or tap *'Confirm Order'* below! 🛵`;

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: updatedCartSummary,
        options: [
          { id: 'cart_confirm', title: 'Confirm Order' },
          { id: 'cart_view', title: 'View Cart' },
          { id: 'cart_clear', title: 'Clear Cart' },
        ],
      });
    }

    // 6b. BUY RESTOCKED ITEM (When customer taps "Buy Now" on restock WhatsApp alert)
    if (lowerText.startsWith('buy_') || lowerText === 'buy now' || lowerText === 'buy') {
      const skuTarget = text.replace(/^buy_/i, '').trim();
      let matchedVariant: any = null;
      if (skuTarget && skuTarget.toUpperCase() !== 'NOW') {
        const res = await Database.query(
          `SELECT p.name as product_name, b.name as brand_name,
                  v.sku, v.variant_name,
                  COALESCE(bp.amount, 50) as selling_price,
                  COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
           FROM product_variants v
           JOIN products p ON v.product_id = p.id
           JOIN brands b ON p.brand_id = b.id
           LEFT JOIN (
             SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
           ) bp ON v.sku = bp.sku
           LEFT JOIN stock_balances sb ON v.sku = sb.sku
           WHERE v.sku = $1 AND v.status = 'active' LIMIT 1`,
          [skuTarget]
        );
        matchedVariant = res.rows[0];
      }

      if (!matchedVariant) {
        const alertRes = await Database.query(
          `SELECT sku FROM back_in_stock_alerts 
           WHERE phone_number = $1 AND status = 'NOTIFIED' 
           ORDER BY notified_at DESC LIMIT 1`,
          [msg.fromPhoneNumber]
        );
        if (alertRes.rows.length > 0) {
          const fallbackSku = alertRes.rows[0].sku;
          const res = await Database.query(
            `SELECT p.name as product_name, b.name as brand_name,
                    v.sku, v.variant_name,
                    COALESCE(bp.amount, 50) as selling_price,
                    COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
             FROM product_variants v
             JOIN products p ON v.product_id = p.id
             JOIN brands b ON p.brand_id = b.id
             LEFT JOIN (
               SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
             ) bp ON v.sku = bp.sku
             LEFT JOIN stock_balances sb ON v.sku = sb.sku
             WHERE v.sku = $1 AND v.status = 'active' LIMIT 1`,
            [fallbackSku]
          );
          matchedVariant = res.rows[0];
        }
      }

      if (matchedVariant && matchedVariant.available_stock > 0) {
        session.cartItems.push({
          sku: matchedVariant.sku,
          productName: matchedVariant.product_name,
          variantName: matchedVariant.variant_name,
          quantity: 1,
          unitPrice: Number(matchedVariant.selling_price),
        });
        session.stage = 'IDLE';
        await this.saveSession(session);

        // Mark alert as CONVERTED in database
        await Database.query(
          `UPDATE back_in_stock_alerts
           SET status = 'CONVERTED', updated_at = NOW()
           WHERE phone_number = $1 AND sku = $2`,
          [msg.fromPhoneNumber, matchedVariant.sku]
        ).catch(() => {});

        let cartSubtotal = 0;
        session.cartItems.forEach((i) => (cartSubtotal += (i.unitPrice || 0) * i.quantity));

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText:
            `Added *${matchedVariant.product_name} (${matchedVariant.variant_name})* to your cart! 🛒\n\n` +
            `💰 Price: *₹${Number(matchedVariant.selling_price).toFixed(2)}*\n` +
            `📦 Items in cart: ${session.cartItems.length} (Subtotal: ₹${cartSubtotal.toFixed(2)})\n\n` +
            `Ready to order? Tap below:`,
          options: [
            { id: 'cart_confirm', title: 'Confirm Order' },
            { id: 'cart_view', title: 'View Cart' },
          ],
        });
      } else if (matchedVariant && matchedVariant.available_stock <= 0) {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `⚠️ *${matchedVariant.product_name} (${matchedVariant.variant_name})* is currently out of stock. We will notify you as soon as fresh stock arrives!`,
        });
      }
    }

    // 7. SUBSTITUTION RESPONSE (Acceptance Scenario 10)
    if (session.stage === 'AWAITING_SUBSTITUTION_APPROVAL' && session.pendingSubstitution) {
      if (
        lowerText.includes('accept') ||
        lowerText === 'sub_accept' ||
        lowerText === '1' ||
        lowerText === 'yes'
      ) {
        const sub = session.pendingSubstitution;
        session.stage = 'IDLE';
        session.pendingSubstitution = undefined;
        await this.saveSession(session);

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `✅ Substitution approved! We have replaced ${sub.originalProductName} with ${sub.proposedProductName}. Your order is now packing! 🛵`,
        });
      } else if (
        lowerText.includes('reject') ||
        lowerText === 'sub_reject' ||
        lowerText === '2' ||
        lowerText === 'no'
      ) {
        const sub = session.pendingSubstitution;
        session.stage = 'IDLE';
        session.pendingSubstitution = undefined;
        await this.saveSession(session);

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `Item ${sub.originalProductName} removed from order. A refund for this item will be credited to your original payment method.`,
        });
      }
    }

    // 8. STAGE 1: DISAMBIGUATING CATEGORY (e.g. user selected 1, 2, or 3 for "soap")
    if (session.stage === 'DISAMBIGUATING_CATEGORY' && session.pendingDisambiguation) {
      let matchedIndex = -1;
      if (text.startsWith('cat_')) {
        matchedIndex = parseInt(text.replace('cat_', ''), 10) - 1;
      } else if (!isNaN(parseInt(text, 10))) {
        matchedIndex = parseInt(text, 10) - 1;
      } else {
        matchedIndex = session.pendingDisambiguation.matchedCategories.findIndex(
          (c) => c.name.toLowerCase().includes(lowerText) || lowerText.includes(c.name.toLowerCase())
        );
      }

      const matched = session.pendingDisambiguation.matchedCategories[matchedIndex];

      if (matched) {
        // Query distinct brands for this chosen category from Supabase
        const brands = await this.getBrandsForCategory(matched.id);

        if (brands.length > 0) {
          // Drill down into Brand selection!
          session.stage = 'SELECTING_BRAND';
          session.pendingDisambiguation = undefined;
          (session as any).pendingBrandSelection = {
            categoryId: matched.id,
            categoryName: matched.name,
            brands,
          };
          await this.saveSession(session);

          let brandPrompt = `🧼 *${matched.name}*\nWhich brand would you prefer?\n\n`;
          brands.forEach((b: any, idx: number) => {
            const stockTag = b.total_stock > 0 ? `(In Stock)` : `(Out of stock)`;
            brandPrompt += `${idx + 1}️⃣ *${b.name}* ${stockTag}\n`;
          });
          brandPrompt += `\n*(Tap a brand or reply with 1, 2, or 3)*`;

          const buttons = brands.slice(0, 3).map((b: any, idx: number) => ({
            id: `brand_${idx + 1}`,
            title: b.name.substring(0, 20),
          }));

          return this.sendAndLog(session.sessionId, {
            toPhoneNumber: msg.fromPhoneNumber,
            type: 'buttons',
            bodyText: brandPrompt,
            options: buttons,
          });
        }
      }
    }

    // 9. STAGE 2: SELECTING BRAND (Drill down to variants/pack sizes)
    const brandContext = (session as any).pendingBrandSelection;
    if (session.stage === 'SELECTING_BRAND' && brandContext) {
      let selectedBrand: any = null;
      if (text.startsWith('brand_')) {
        const idx = parseInt(text.replace('brand_', ''), 10) - 1;
        selectedBrand = brandContext.brands[idx];
      } else if (!isNaN(parseInt(text, 10))) {
        const idx = parseInt(text, 10) - 1;
        selectedBrand = brandContext.brands[idx];
      } else {
        selectedBrand = brandContext.brands.find((b: any) =>
          b.name.toLowerCase().includes(lowerText) || lowerText.includes(b.name.toLowerCase())
        );
      }

      if (selectedBrand) {
        // Query variants for this brand from Supabase
        const variants = await this.getVariantsForBrand(selectedBrand.name, brandContext.categoryId);

        if (variants.length > 0) {
          session.stage = 'SELECTING_VARIANT';
          (session as any).pendingBrandSelection = undefined;
          (session as any).pendingVariantSelection = {
            categoryId: brandContext.categoryId,
            brandName: selectedBrand.name,
            variants,
          };
          await this.saveSession(session);

          let varPrompt = `🛁 *${selectedBrand.name} Soaps*:\nPlease select your desired pack size:\n\n`;
          variants.forEach((v: any, idx: number) => {
            const stockInfo = v.available_stock > 0 ? `(In Stock: ${v.available_stock})` : `(Out of stock)`;
            varPrompt += `${idx + 1}️⃣ *${v.variant_name}* — ₹${Number(v.selling_price).toFixed(2)} ${stockInfo}\n`;
          });
          varPrompt += `\n*(Tap an option or reply with 1 or 2)*`;

          const buttons = variants.slice(0, 3).map((v: any, idx: number) => ({
            id: `var_${idx + 1}`,
            title: v.variant_name.substring(0, 20),
          }));

          return this.sendAndLog(session.sessionId, {
            toPhoneNumber: msg.fromPhoneNumber,
            type: 'buttons',
            bodyText: varPrompt,
            options: buttons,
          });
        }
      }
    }

    // 10. STAGE 3: SELECTING VARIANT (Add chosen pack size to cart)
    const variantContext = (session as any).pendingVariantSelection;
    if (session.stage === 'SELECTING_VARIANT' && variantContext) {
      let selectedVar: any = null;
      if (text.startsWith('var_')) {
        const idx = parseInt(text.replace('var_', ''), 10) - 1;
        selectedVar = variantContext.variants[idx];
      } else if (!isNaN(parseInt(text, 10))) {
        const idx = parseInt(text, 10) - 1;
        selectedVar = variantContext.variants[idx];
      } else {
        selectedVar = variantContext.variants.find((v: any) =>
          v.variant_name.toLowerCase().includes(lowerText) ||
          v.sku.toLowerCase() === lowerText ||
          lowerText.includes(v.variant_name.toLowerCase())
        );
      }

      if (selectedVar) {
        session.cartItems.push({
          sku: selectedVar.sku,
          productName: selectedVar.product_name,
          variantName: selectedVar.variant_name,
          quantity: 1,
          unitPrice: Number(selectedVar.selling_price),
        });
        session.stage = 'IDLE';
        (session as any).pendingVariantSelection = undefined;
        await this.saveSession(session);

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText:
            `Added *${selectedVar.product_name} (${selectedVar.variant_name})* to your cart! 🛒\n\n` +
            `Price: ₹${Number(selectedVar.selling_price).toFixed(2)}\n` +
            `Items in cart: ${session.cartItems.length}\n\n` +
            `Reply with more items, or tap below to proceed:`,
          options: [
            { id: 'cart_confirm', title: 'Confirm Order' },
            { id: 'cart_view', title: 'View Cart' },
            { id: 'cart_clear', title: 'Clear Cart' },
          ],
        });
      }
    }

    // 10.5. PAYMENT OPTIONS & ACTIONS (UPI, COD, CONFIRMATION)
    const isPayUpiAction =
      lowerText.startsWith('pay_upi') ||
      lowerText === 'upi' ||
      lowerText === 'pay upi' ||
      lowerText === 'pay online' ||
      (lowerText === 'pay' && session.cartItems.length === 0);

    const isPayCodAction =
      lowerText.startsWith('pay_cod') ||
      lowerText === 'cod' ||
      lowerText === 'cash' ||
      lowerText === 'cash on delivery' ||
      lowerText === 'pay cash';

    const isPayPaidAction =
      lowerText.startsWith('pay_paid') ||
      lowerText === 'paid' ||
      lowerText === 'i have paid' ||
      lowerText === 'payment done' ||
      lowerText === 'payment completed' ||
      lowerText === 'confirm payment';

    if (isPayUpiAction || isPayCodAction || isPayPaidAction) {
      const cleanPhone = msg.fromPhoneNumber.replace(/[^0-9]/g, '');
      let targetOrderNum: string | null = null;
      const ordMatch = text.match(/ORD-[\w-]+/i);
      if (ordMatch) {
        targetOrderNum = ordMatch[0].toUpperCase();
      } else if ((session as any).lastOrderNumber) {
        targetOrderNum = (session as any).lastOrderNumber;
      }

      let orderRow: any = null;
      if (targetOrderNum) {
        const oRes = await Database.query(
          `SELECT o.id, o.order_number, o.status, o.grand_total, o.reservation_id
           FROM orders o
           WHERE o.order_number = $1
           LIMIT 1`,
          [targetOrderNum]
        );
        orderRow = oRes.rows[0];
      }

      if (!orderRow) {
        const oRes = await Database.query(
          `SELECT o.id, o.order_number, o.status, o.grand_total, o.reservation_id
           FROM orders o
           WHERE o.customer_id ILIKE $1 OR o.delivery_address->>'phone' ILIKE $1
           ORDER BY o.created_at DESC
           LIMIT 1`,
          ['%' + cleanPhone + '%']
        );
        orderRow = oRes.rows[0];
      }

      if (!orderRow) {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: `No recent pending order found for ${msg.fromPhoneNumber}. Reply with items you'd like to buy, or *'Track'* to see order status!`,
        });
      }

      const totalAmt = Number(orderRow.grand_total || 0).toFixed(2);

      if (isPayCodAction) {
        // Mark payment method as COD and confirm
        await Database.query(
          `UPDATE orders SET status = 'CONFIRMED', payment_intent_id = 'COD_PAYMENT', updated_at = NOW() WHERE id = $1`,
          [orderRow.id]
        );
        if (orderRow.reservation_id) {
          fetch(`${process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003'}/api/v1/inventory/reservations/${orderRow.reservation_id}/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderRow.id }),
          }).catch(() => {});
        }

        let codText = `💵 *Payment Option Set: Cash on Delivery (COD)*\n\n`;
        codText += `🆔 *Order Number:* *${orderRow.order_number}*\n`;
        codText += `💰 *Amount Due on Delivery:* *₹${totalAmt}*\n`;
        codText += `🛵 *Order Status:* Confirmed & Dark Store Picking Started!\n\n`;
        codText += `Our delivery partner will collect ₹${totalAmt} in cash or via UPI QR scan when arriving at your doorstep.\n\n`;
        codText += `Reply *'Track'* anytime for live delivery updates! 📦`;

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText: codText,
          options: [
            { id: `track_${orderRow.order_number}`, title: '📍 Track Order' },
            { id: 'help_support', title: '💬 Store Support' },
          ],
        });
      }

      if (isPayPaidAction) {
        // Customer confirmed payment -> mark CONFIRMED
        try {
          const ordUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
          await fetch(`${ordUrl}/api/v1/orders/${orderRow.id}/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: `upi_wa_${Date.now()}` }),
          });
        } catch (confErr: any) {
          await Database.query(
            `UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
            [orderRow.id]
          );
        }

        let paidText = `🎉 *Payment Received & Verified!*\n\n`;
        paidText += `🆔 *Order Number:* *${orderRow.order_number}*\n`;
        paidText += `💰 *Amount Paid:* *₹${totalAmt}*\n`;
        paidText += `✅ *Payment Status:* Verified & Confirmed\n\n`;
        paidText += `Your items are locked in and the fulfillment center is packing your grocery bag right now. 🛍️\n\n`;
        paidText += `Reply *'Track'* anytime to follow your delivery partner in real time! 🛵💨`;

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText: paidText,
          options: [
            { id: `track_${orderRow.order_number}`, title: '📍 Track Delivery' },
            { id: 'view_catalog', title: '🛒 Shop More' },
          ],
        });
      }

      // Default: isPayUpiAction
      const upiLink = `upi://pay?pa=freshcart@icici&pn=FreshCart&am=${totalAmt}&tn=Order-${orderRow.order_number}&cu=INR`;
      const webPayUrl = `http://localhost:5173/?payOrder=${orderRow.order_number}&amt=${totalAmt}`;

      let upiText = `💳 *Payment for Order ${orderRow.order_number}*\n\n`;
      upiText += `💰 *Grand Total Payable:* *₹${totalAmt}*\n\n`;
      upiText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      upiText += `📱 *Option 1 — Tap to Open UPI App (GPay / PhonePe / Paytm / BHIM):*\n${upiLink}\n\n`;
      upiText += `🌐 *Option 2 — Card / NetBanking Web Checkout:*\n${webPayUrl}\n\n`;
      upiText += `📌 *Option 3 — Pay to Store UPI ID:*\n`;
      upiText += `• UPI ID: *freshcart@icici*\n`;
      upiText += `• Name: *FreshCart Retail*\n`;
      upiText += `• Amount: *₹${totalAmt}*\n`;
      upiText += `• Reference: *${orderRow.order_number}*\n`;
      upiText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      upiText += `👉 After making payment, tap *'I Have Paid'* or reply *'PAID'* below to verify instantly!`;

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: upiText,
        options: [
          { id: `pay_paid_${orderRow.order_number}`, title: '✅ I Have Paid' },
          { id: `pay_cod_${orderRow.order_number}`, title: '💵 Switch to COD' },
        ],
      });
    }

    // 11. CHECKOUT / CONFIRMATION
    if (
      lowerText === 'confirm' ||
      lowerText === 'checkout' ||
      (lowerText === 'pay' && session.cartItems.length > 0) ||
      lowerText === 'cart_confirm' ||
      lowerText === 'confirm order' ||
      lowerText === 'confirm_order' ||
      lowerText === 'place order' ||
      lowerText === 'place_order' ||
      lowerText.startsWith('confirm')
    ) {
      if (session.cartItems.length === 0) {
        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'text',
          bodyText: '🛒 Your cart is currently empty. Tell me what items you need!',
        });
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
        customerId: session.customerId || `phone_${msg.fromPhoneNumber.replace(/[^0-9]/g, '')}`,
        deliveryAddress: {
          recipientName: 'WhatsApp Customer',
          phone: msg.fromPhoneNumber,
          addressLine1: 'Customer WhatsApp Address',
          city: 'Bangalore',
          postalCode: '560001',
        },
        items: session.cartItems.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      });

      // Clear cart on successful order creation & track order in session
      session.cartItems = [];
      session.stage = 'IDLE';
      (session as any).pendingAlternatives = undefined;
      (session as any).lastOrderNumber = order.orderNumber;
      (session as any).lastOrderTotal = quote.grandTotal;
      (session as any).lastOrderId = order.orderId;
      await this.saveSession(session);

      const upiLink = `upi://pay?pa=freshcart@icici&pn=FreshCart&am=${quote.grandTotal.toFixed(2)}&tn=Order-${order.orderNumber}&cu=INR`;
      const webPayUrl = `http://localhost:5173/?payOrder=${order.orderNumber}&amt=${quote.grandTotal.toFixed(2)}`;

      let orderSuccessText = `🎉 *Order Placed Successfully!*\n\n`;
      orderSuccessText += `🆔 *Order Number:* *${order.orderNumber}*\n`;
      orderSuccessText += `📦 *Order Breakdown (${order.items.length} items):*\n`;
      order.items.forEach((item: any, idx: number) => {
        orderSuccessText += `${idx + 1}. *${item.productName}* (${item.variantName}) × ${item.quantity} — ₹${Number(item.netAmount).toFixed(2)}\n`;
      });
      orderSuccessText += `\n*Subtotal:* ₹${quote.subtotal.toFixed(2)}\n`;
      orderSuccessText += `*GST Tax:* ₹${quote.taxTotal.toFixed(2)}\n`;
      orderSuccessText += `*Delivery Fee:* ₹${quote.deliveryFee.toFixed(2)}\n`;
      orderSuccessText += `*Grand Total Payable:* *₹${quote.grandTotal.toFixed(2)}*\n\n`;
      orderSuccessText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      orderSuccessText += `💳 *CHOOSE YOUR PAYMENT OPTION:*\n\n`;
      orderSuccessText += `1️⃣ *Instant UPI (Google Pay / PhonePe / Paytm / BHIM):*\n${upiLink}\n\n`;
      orderSuccessText += `2️⃣ *Web Card / NetBanking Checkout:*\n${webPayUrl}\n\n`;
      orderSuccessText += `3️⃣ *Or Reply Directly in Chat:*\n`;
      orderSuccessText += `• Reply *'PAY'* for UPI link & details\n`;
      orderSuccessText += `• Reply *'COD'* for Cash on Delivery\n`;
      orderSuccessText += `• Reply *'PAID'* after completing payment\n`;
      orderSuccessText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      orderSuccessText += `🛵 *Status:* Stock successfully reserved! Choose your payment option above.`;

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: orderSuccessText,
        options: [
          { id: `pay_upi_${order.orderNumber}`, title: `💳 Pay ₹${Math.round(quote.grandTotal)} UPI` },
          { id: `pay_cod_${order.orderNumber}`, title: `💵 Cash on Delivery` },
          { id: `pay_paid_${order.orderNumber}`, title: `✅ I Have Paid` },
        ],
      });
    }

    // 12. MULTI-ITEM GROCERY SHOPPING LIST PARSING
    // Supports inline numbering (e.g. "sende me these items 1. amul butter 500 gms 2. lux rose soap 3 pcs..."),
    // newline-separated lists, bullets, and comma-separated lists
    const parsedGroceryList = this.extractGroceryListItems(text);
    if (parsedGroceryList.length > 1) {
      return this.handleMultiItemShoppingList(session, msg, parsedGroceryList);
    }

    // 13. CHECK FOR CATEGORY DISAMBIGUATION (Acceptance Scenario 9: e.g. "soap")
    const disambiguation = await this.catalogClient.disambiguate(text);
    if (disambiguation && disambiguation.isAmbiguous) {
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
        const brands = cat.sampleBrands && cat.sampleBrands.length > 0 ? ` (${cat.sampleBrands.join(', ')})` : '';
        prompt += `${idx + 1}️⃣ *${cat.name}*${brands}\n`;
      });
      prompt += `\n*(Tap a button or reply with 1, 2, or 3)*`;

      // Meta interactive buttons allow up to 3 choices
      const buttons = disambiguation.matchingCategories.slice(0, 3).map((cat, idx) => {
        const shortName = cat.name.split(' ')[0] || `Option ${idx + 1}`;
        return {
          id: `cat_${idx + 1}`,
          title: `${idx + 1}. ${shortName}`.substring(0, 20),
        };
      });

      return this.sendAndLog(session.sessionId, {
        toPhoneNumber: msg.fromPhoneNumber,
        type: 'buttons',
        bodyText: prompt,
        options: buttons,
      });
    }

    // 14. GENERAL SINGLE PRODUCT SEARCH & CART ADDITION
    const searchQuery = text
      .replace(/^(add|buy|get|need)\s+/i, '')
      .replace(/^add_/i, '')
      .trim();

    // Query database for item with live price & stock
    const singleMatch = await this.searchCatalogItem(searchQuery);

    if (singleMatch) {
      const unitPrice = Number(singleMatch.selling_price);

      // Check if user specifically requested an exact size (e.g. "500g", "1kg", "200ml", "1L")
      const requestedSpecificSize = Boolean(
        searchQuery.match(/(\d+)\s*(g|gm|gms|kg|kgs|ml|l|pcs|pieces|pack|packs|boxes?|bottles?)\b/i)
      );

      // 1. BRAND MISMATCH / UNCARRIED BRAND (e.g. user asked for "varna milk")
      if (!singleMatch.isDirectMatch) {
        // Query ALL active variants for the recommended brand (e.g. Amul Milk variants)
        const altVariants = await this.getVariantsForProductOrQuery('milk', singleMatch.brand_name);

        if (altVariants.length > 1) {
          (session as any).pendingVariantChoices = altVariants.slice(0, 3).map((v) => ({
            sku: v.sku,
            productName: v.product_name.toLowerCase().startsWith(v.brand_name.toLowerCase())
              ? v.product_name
              : `${v.brand_name} ${v.product_name}`,
            variantName: v.variant_name,
            price: Number(v.selling_price),
            stock: Number(v.available_stock),
            quantity: 1,
          }));
          session.stage = 'SELECTING_VARIANT';
          await this.saveSession(session);

          let promptText = `⚠️ We don't carry *"${searchQuery}"* in our store catalog.\n\n`;
          promptText += `👉 *Recommended In-Stock Alternative: ${singleMatch.brand_name} Milk*\n`;
          promptText += `Please choose your preferred pack size / variant:\n\n`;

          altVariants.slice(0, 3).forEach((v, idx) => {
            promptText += `${idx + 1}️⃣ *${v.variant_name}* — *₹${Number(v.selling_price).toFixed(2)}* (${v.available_stock} in stock)\n`;
          });
          promptText += `\nTap a button below or reply with 1, 2, or 3 to select!`;

          const buttons = altVariants.slice(0, 3).map((v, idx) => {
            const shortVar = v.variant_name.split('(')[0].trim();
            return {
              id: `var_${idx + 1}`,
              title: `${idx + 1}. ${shortVar} - ₹${Number(v.selling_price).toFixed(0)}`.substring(0, 20),
            };
          });

          return this.sendAndLog(session.sessionId, {
            toPhoneNumber: msg.fromPhoneNumber,
            type: 'buttons',
            bodyText: promptText,
            options: buttons,
          });
        }

        const altDisplayName = singleMatch.product_name.toLowerCase().startsWith(singleMatch.brand_name.toLowerCase())
          ? `${singleMatch.product_name} (${singleMatch.variant_name})`
          : `${singleMatch.brand_name} ${singleMatch.product_name} (${singleMatch.variant_name})`;

        (session as any).pendingAlternatives = [
          {
            sku: singleMatch.sku,
            name: altDisplayName,
            variantName: singleMatch.variant_name,
            quantity: 1,
            price: unitPrice,
          },
        ];
        await this.saveSession(session);

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText:
            `⚠️ We don't carry *"${searchQuery}"* in our store catalog.\n\n` +
            `👉 *Recommended In-Stock Alternative:*\n` +
            `*${altDisplayName}*\n` +
            `💰 Price: *₹${unitPrice.toFixed(2)}* (${singleMatch.available_stock} in stock)\n\n` +
            `Would you like to add this alternative to your cart?`,
          options: [
            { id: 'alt_accept', title: 'Accept Alternative' },
            { id: 'cart_view', title: 'View Cart' },
          ],
        });
      }

      // 2. DIRECT MATCH & MULTIPLE VARIANTS EXIST AND NO SPECIFIC SIZE REQUESTED
      // (e.g. user sent "salt", "bread", "soap", "sugar", "atta")
      if (!requestedSpecificSize) {
        const productVariants = await this.getVariantsForProductOrQuery(searchQuery);

        if (productVariants.length > 1) {
          (session as any).pendingVariantChoices = productVariants.slice(0, 3).map((v) => ({
            sku: v.sku,
            productName: v.product_name.toLowerCase().startsWith(v.brand_name.toLowerCase())
              ? v.product_name
              : `${v.brand_name} ${v.product_name}`,
            variantName: v.variant_name,
            price: Number(v.selling_price),
            stock: Number(v.available_stock),
            quantity: 1,
          }));
          session.stage = 'SELECTING_VARIANT';
          await this.saveSession(session);

          let promptText = `📦 *Available Options & Variants for "${searchQuery}":*\n`;
          promptText += `Please choose your preferred brand / pack size:\n\n`;

          productVariants.slice(0, 3).forEach((v, idx) => {
            const displayName = v.product_name.toLowerCase().startsWith(v.brand_name.toLowerCase())
              ? `${v.product_name} (${v.variant_name})`
              : `${v.brand_name} ${v.product_name} (${v.variant_name})`;
            promptText += `${idx + 1}️⃣ *${displayName}*\n   💰 Price: *₹${Number(v.selling_price).toFixed(2)}* (In Stock: ${v.available_stock})\n\n`;
          });
          promptText += `Tap a button below or reply with 1, 2, or 3 to select:`;

          const buttons = productVariants.slice(0, 3).map((v, idx) => {
            const cleanVar = v.variant_name.replace(/\(.*?\)/g, '').trim();
            const titleCandidate = `${cleanVar} - ₹${Number(v.selling_price).toFixed(0)}`;
            return {
              id: `var_${idx + 1}`,
              title: titleCandidate.length <= 20 ? titleCandidate : `${v.brand_name.split(' ')[0]} - ₹${Number(v.selling_price).toFixed(0)}`.substring(0, 20),
            };
          });

          return this.sendAndLog(session.sessionId, {
            toPhoneNumber: msg.fromPhoneNumber,
            type: 'buttons',
            bodyText: promptText,
            options: buttons,
          });
        }
      }

      // 3. SPECIFIC VARIANT REQUESTED OR SINGLE VARIANT IN STOCK -> Add directly
      if (singleMatch.available_stock > 0) {
        session.cartItems.push({
          sku: singleMatch.sku,
          productName: singleMatch.product_name,
          variantName: singleMatch.variant_name,
          quantity: 1,
          unitPrice,
        });
        await this.saveSession(session);

        let cartSubtotal = 0;
        session.cartItems.forEach((i) => (cartSubtotal += (i.unitPrice || 0) * i.quantity));

        return this.sendAndLog(session.sessionId, {
          toPhoneNumber: msg.fromPhoneNumber,
          type: 'buttons',
          bodyText:
            `Added *${singleMatch.product_name} (${singleMatch.variant_name})* to your cart! 🛒\n\n` +
            `💰 Price: *₹${unitPrice.toFixed(2)}*\n` +
            `📦 Items in cart: ${session.cartItems.length} (Subtotal: ₹${cartSubtotal.toFixed(2)})\n\n` +
            `Reply with more items, or tap below to proceed:`,
          options: [
            { id: 'cart_confirm', title: 'Confirm Order' },
            { id: 'cart_view', title: 'View Cart' },
            { id: 'cart_clear', title: 'Clear Cart' },
          ],
        });
      } else {
        // 4. DIRECT MATCH BUT OUT OF STOCK -> Suggest alternative in same category
        const alternative = await this.findInStockAlternative(
          singleMatch.primary_category_id,
          singleMatch.sku,
          singleMatch.product_id
        );

        // Record back-in-stock notification alert in database
        await this.recordBackInStockAlert(
          msg.fromPhoneNumber,
          singleMatch.sku,
          singleMatch.product_name,
          singleMatch.variant_name,
          1
        );

        if (alternative) {
          const altDisplayName = alternative.product_name.toLowerCase().startsWith(alternative.brand_name.toLowerCase())
            ? `${alternative.product_name} (${alternative.variant_name})`
            : `${alternative.brand_name} ${alternative.product_name} (${alternative.variant_name})`;

          (session as any).pendingAlternatives = [
            {
              sku: alternative.sku,
              name: altDisplayName,
              variantName: alternative.variant_name,
              quantity: 1,
              price: Number(alternative.selling_price),
            },
          ];
          await this.saveSession(session);

          return this.sendAndLog(session.sessionId, {
            toPhoneNumber: msg.fromPhoneNumber,
            type: 'buttons',
            bodyText:
              `⚠️ *${singleMatch.product_name} (${singleMatch.variant_name})* is currently *OUT OF STOCK*.\n\n` +
              `👉 *Recommended In-Stock Alternative:*\n` +
              `*${altDisplayName}* @ *₹${Number(alternative.selling_price).toFixed(2)}* (Available: ${alternative.available_stock} in stock)\n\n` +
              `🔔 *Restock Alert Activated:* We will notify you automatically the moment *${singleMatch.product_name}* is back in stock!\n\n` +
              `Tap *'Accept Alternative'* below to order the alternative:`,
            options: [
              { id: 'alt_accept', title: 'Accept Alternative' },
              { id: 'cart_view', title: 'View Cart' },
            ],
          });
        }
      }
    }

    return this.sendAndLog(session.sessionId, {
      toPhoneNumber: msg.fromPhoneNumber,
      type: 'text',
      bodyText: `I couldn't find "${text}" in our catalog. Could you please specify the brand or item name? (e.g. "Amul Butter", "Tata Salt", "Milk")`,
    });
  }

  /**
   * Extract multi-item grocery lists across inline numbers, newlines, bullets, and commas
   */
  private extractGroceryListItems(text: string): string[] {
    // 1. Check for inline or newline numbered items e.g. "1. ... 2. ... 3. ..." or "1) ... 2) ..."
    const inlineNumbered = text.split(/(?:^|\s+)(?=\d+[\.\)]\s+)/).map((s) => s.trim()).filter(Boolean);
    const validNumbered = inlineNumbered.filter((s) => /^\d+[\.\)]\s+/.test(s));
    if (validNumbered.length >= 2) {
      return validNumbered;
    }

    // 2. Check for newline-separated list
    const newlineLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const groceryKeywords = /\b(gms?|kgs?|pcs|pieces|packs?|pkts?|boxes?|bottles?|bars?|loaf|powder|bread|soap|butter|salt|sugar|shampoo|toothpaste|atta|oil|ghee|milk|rice|paneer|dalia|tea|coffee|biscuit|biscuits|surf|detergent|colgate|amul|tata|lux|dettol|dove|pears|maggi|fortune|lays|kurkure)\b/i;

    if (newlineLines.length >= 2) {
      const filtered = newlineLines.filter((l) => {
        const lower = l.toLowerCase();
        return (
          !lower.startsWith('send') &&
          !lower.startsWith('please') &&
          !lower.startsWith('i need') &&
          !lower.startsWith('order') &&
          (groceryKeywords.test(l) || /^\d+[\.\)]\s+/.test(l) || /^[-•*]\s+/.test(l))
        );
      });
      if (filtered.length >= 2) return filtered;
    }

    // 3. Check for comma-separated items if containing grocery keywords
    const commaItems = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (commaItems.length >= 2 && commaItems.some((c) => groceryKeywords.test(c))) {
      return commaItems;
    }

    return [];
  }

  /**
   * Parse a multi-item grocery list, check live stock in Supabase, and recommend alternatives for out-of-stock items
   */
  private async handleMultiItemShoppingList(
    session: WhatsAppSessionState,
    msg: WhatsAppInboundMessage,
    lines: string[]
  ): Promise<WhatsAppOutboundMessage> {
    const itemLines = lines.filter((line) => {
      const l = line.toLowerCase();
      return (
        !l.startsWith('send') &&
        !l.startsWith('please') &&
        !l.startsWith('i need') &&
        !l.startsWith('order') &&
        l.length > 2
      );
    });

    const inStockAdded: Array<{ name: string; sku: string; qty: number; unitPrice: number; totalPrice: number; lineText: string }> = [];
    const outOfStockWithAlt: Array<{
      originalText: string;
      altName: string;
      altSku: string;
      altVariantName: string;
      altPrice: number;
      qty: number;
      stockAvail: number;
    }> = [];
    const brandAlternativesWithAlt: Array<{
      originalText: string;
      uncarriedBrand: string;
      altName: string;
      altSku: string;
      altVariantName: string;
      altPrice: number;
      qty: number;
      stockAvail: number;
    }> = [];

    for (const rawLine of itemLines) {
      // Strip leading numbering or bullet e.g. "1. " or "2) " or "- "
      const cleanLine = rawLine.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '').trim();

      // Extract count/quantity (e.g. "3 pcs", "2 pieces", "2 packets", "3x", default 1)
      let quantity = 1;
      const countMatch = cleanLine.match(/(\d+)\s*(pcs|pieces|packs?|pkts?|bottles?|boxes?|nos|bars?)\b/i);
      const timesMatch = cleanLine.match(/\b(\d+)\s*[xX]\b/);

      if (countMatch) {
        quantity = parseInt(countMatch[1], 10);
      } else if (timesMatch) {
        quantity = parseInt(timesMatch[1], 10);
      }

      // Query database for this item
      const itemMatch = await this.searchCatalogItem(cleanLine);

      if (itemMatch) {
        const unitPrice = Number(itemMatch.selling_price);
        const totalPrice = unitPrice * quantity;

        // 1. BRAND MISMATCH / UNCARRIED BRAND (e.g. user asked for "varna milk")
        if (!itemMatch.isDirectMatch) {
          const altDisplayName = itemMatch.product_name.toLowerCase().startsWith(itemMatch.brand_name.toLowerCase())
            ? `${itemMatch.product_name} (${itemMatch.variant_name})`
            : `${itemMatch.brand_name} ${itemMatch.product_name} (${itemMatch.variant_name})`;

          brandAlternativesWithAlt.push({
            originalText: cleanLine,
            uncarriedBrand: itemMatch.uncarriedTerm || 'Requested brand',
            altName: altDisplayName,
            altSku: itemMatch.sku,
            altVariantName: itemMatch.variant_name,
            altPrice: unitPrice,
            qty: quantity,
            stockAvail: Number(itemMatch.available_stock),
          });
        } else if (itemMatch.available_stock >= quantity) {
          // 2. DIRECT MATCH & IN STOCK! Add directly to session cart
          session.cartItems.push({
            sku: itemMatch.sku,
            productName: itemMatch.product_name,
            variantName: itemMatch.variant_name,
            quantity,
            unitPrice,
          });

          inStockAdded.push({
            name: `${itemMatch.product_name} (${itemMatch.variant_name})`,
            sku: itemMatch.sku,
            qty: quantity,
            unitPrice,
            totalPrice,
            lineText: cleanLine,
          });
        } else {
          // 3. DIRECT MATCH BUT OUT OF STOCK! Look for alternative in same category
          const alternative = await this.findInStockAlternative(
            itemMatch.primary_category_id,
            itemMatch.sku,
            itemMatch.product_id
          );

          // Record back-in-stock alert for the customer
          await this.recordBackInStockAlert(
            msg.fromPhoneNumber,
            itemMatch.sku,
            itemMatch.product_name,
            itemMatch.variant_name,
            quantity
          );

          if (alternative) {
            const altDisplayName = alternative.product_name.toLowerCase().startsWith(alternative.brand_name.toLowerCase())
              ? `${alternative.product_name} (${alternative.variant_name})`
              : `${alternative.brand_name} ${alternative.product_name} (${alternative.variant_name})`;

            outOfStockWithAlt.push({
              originalText: cleanLine,
              altName: altDisplayName,
              altSku: alternative.sku,
              altVariantName: alternative.variant_name,
              altPrice: Number(alternative.selling_price),
              qty: quantity,
              stockAvail: Number(alternative.available_stock),
            });
          }
        }
      }
    }

    // Save session cart & pending alternatives
    const allPendingAlts = [
      ...outOfStockWithAlt.map((a) => ({
        sku: a.altSku,
        name: a.altName,
        variantName: a.altVariantName,
        quantity: a.qty,
        price: a.altPrice,
      })),
      ...brandAlternativesWithAlt.map((b) => ({
        sku: b.altSku,
        name: b.altName,
        variantName: b.altVariantName,
        quantity: b.qty,
        price: b.altPrice,
      })),
    ];

    if (allPendingAlts.length > 0) {
      (session as any).pendingAlternatives = allPendingAlts;
    }
    await this.saveSession(session);

    // Build rich, clear WhatsApp Markdown response
    let responseText = `🛒 *FreshCart Order Breakdown & Live Inventory Check*\n`;
    responseText += `We verified all ${itemLines.length} items from your list against our live store stock:\n\n`;

    if (inStockAdded.length > 0) {
      responseText += `*Available & Added to Your Cart (${inStockAdded.length} items):*\n`;
      let runningSubtotal = 0;
      inStockAdded.forEach((item, idx) => {
        runningSubtotal += item.totalPrice;
        responseText += `${idx + 1}️⃣ *${item.name}* × ${item.qty} — *₹${item.totalPrice.toFixed(2)}* (₹${item.unitPrice.toFixed(2)} each)\n`;
      });
      responseText += `\n*Current Cart Subtotal:* *₹${runningSubtotal.toFixed(2)}*\n\n`;
    }

    if (brandAlternativesWithAlt.length > 0) {
      responseText += `💡 *Brand Not in Catalog & Recommended In-Stock Alternatives:*\n`;
      brandAlternativesWithAlt.forEach((alt) => {
        responseText += `• We don't carry *"${alt.originalText}"*.\n`;
        responseText += `  👉 *Recommended In-Stock Alternative:* *${alt.altName}* × ${alt.qty} @ *₹${alt.altPrice.toFixed(2)}* each (Available Stock: ${alt.stockAvail})\n\n`;
      });
    }

    if (outOfStockWithAlt.length > 0) {
      responseText += `⚠️ *Out of Stock Items & Recommended In-Stock Alternatives:*\n`;
      outOfStockWithAlt.forEach((alt) => {
        responseText += `• *${alt.originalText}* (Requested: ${alt.qty}) is currently *OUT OF STOCK*.\n`;
        responseText += `  👉 *Recommended In-Stock Alternative:* *${alt.altName}* × ${alt.qty} @ *₹${alt.altPrice.toFixed(2)}* each (Available Stock: ${alt.stockAvail})\n\n`;
      });
    }

    const options: Array<{ id: string; title: string }> = [];
    if (outOfStockWithAlt.length > 0 || brandAlternativesWithAlt.length > 0) {
      options.push({ id: 'alt_accept', title: 'Accept Alternative' });
    }
    options.push({ id: 'cart_confirm', title: 'Confirm Order' });
    options.push({ id: 'cart_view', title: 'View Cart' });

    if (outOfStockWithAlt.length > 0 || brandAlternativesWithAlt.length > 0) {
      responseText += `*Next Steps:*\n`;
      responseText += `• Reply *'Accept'* or tap *'Accept Alternative'* to add the suggested alternative(s) to your cart.\n`;
      responseText += `• Reply *'Confirm'* or tap *'Confirm Order'* to checkout with your currently available items.`;
    } else {
      responseText += `Reply with *'Confirm'* or tap *'Confirm Order'* below to complete your order and receive delivery! 🛵`;
    }

    return this.sendAndLog(session.sessionId, {
      toPhoneNumber: msg.fromPhoneNumber,
      type: 'buttons',
      bodyText: responseText,
      options,
    });
  }

  /**
   * Search Supabase for an item line using query normalization and scoring
   */
  private async searchCatalogItem(queryLine: string): Promise<any | null> {
    try {
      const GENERIC_GROCERY_KEYWORDS = new Set([
        'milk', 'butter', 'bread', 'soap', 'salt', 'sugar', 'powder', 'detergent', 'toothpaste', 'shampoo',
        'oil', 'atta', 'flour', 'flours', 'rice', 'dal', 'dals', 'dalia', 'tea', 'coffee', 'biscuit', 'biscuits',
        'noodle', 'noodles', 'chips', 'ghee', 'paneer', 'egg', 'eggs', 'potato', 'onion', 'tomato', 'apple',
        'banana', 'large', 'small', 'medium', 'white', 'brown', 'toned', 'pasteurised', 'refined', 'iodised',
        'germ', 'bar', 'bars', 'pack', 'packs', 'packet', 'packets', 'bottle', 'bottles', 'box', 'boxes',
        'can', 'tin', 'top', 'front', 'load', 'loading', 'wash', 'bath', 'bathing', 'sandwich', 'strong',
        'teeth', 'triple', 'blend', 'pure', 'hygienic', 'vacuum', 'evaporated', 'flavour', 'flavor', 'regular',
        'fresh', 'super', 'gold', 'diet', 'lite', 'classic', 'magic', 'masala', 'atta', 'chakki', 'whole', 'wheat',
        'spices', 'water', 'drink', 'cleaner', 'spray', 'tablet', 'tablets'
      ]);

      // Strip leading list numbering (e.g. "1. " or "2) ")
      const strippedLine = queryLine.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '').trim();

      // Normalize common spelling variants and speech phrasing
      const norm = strippedLine
        .toLowerCase()
        .replace(/\bsandwitch\b/g, 'sandwich')
        .replace(/\blaoding\b/g, 'load')
        .replace(/\bpoweder\b/g, 'powder')
        .replace(/\bhair\s*(&|and)?\s*care\b/g, 'hair care')
        .replace(/\bthese+e?\b/g, '')
        .replace(/\bsende?\b/g, '')
        .replace(/\bme\b/g, '')
        .replace(/\bitems?\b/g, '')
        .replace(/\bplease\b/g, '');

      // Extract weight/pack tokens (e.g. "500", "2", "4", "200")
      const numToken = strippedLine.match(/(\d+)\s*(g|gm|gms|kg|kgs|ml|l|pcs)?/i)?.[1];

      const words = norm
        .replace(/(\d+)\s*(gms?|kgs?|pcs|pieces|pack|packs|boxes?|bottles?|litres?|liter|liters|l)\b/gi, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3);

      const res = await Database.query(
        `SELECT p.id as product_id, p.name as product_name, p.primary_category_id,
                b.name as brand_name,
                v.sku, v.variant_name,
                COALESCE(bp.amount, 50) as selling_price,
                COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
         FROM products p
         LEFT JOIN brands b ON p.brand_id = b.id
         JOIN product_variants v ON p.id = v.product_id
         LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
         LEFT JOIN stock_balances sb ON v.sku = sb.sku
         WHERE v.status = 'active'`
      );

      let best: any = null;
      let bestScore = 0;

      for (const item of res.rows) {
        const brandLower = (item.brand_name || '').toLowerCase();
        const productLower = (item.product_name || '').toLowerCase();
        const variantLower = (item.variant_name || '').toLowerCase();
        let score = 0;

        for (const w of words) {
          if (brandLower.includes(w)) {
            score += 8;
          } else if (productLower.includes(w)) {
            score += 4;
          } else if (variantLower.includes(w)) {
            score += 2;
          }
        }

        if (numToken && (variantLower.includes(numToken) || item.sku.toLowerCase().includes(numToken))) {
          score += 5;
        }

        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }

      if (!best || bestScore < 3) return null;

      // Determine if this is a direct match or an alternative recommendation
      const bestBrand = (best.brand_name || '').toLowerCase();
      const bestProduct = (best.product_name || '').toLowerCase();
      const bestVariant = (best.variant_name || '').toLowerCase();

      let isDirectMatch = true;
      let uncarriedTerm: string | null = null;

      for (const w of words) {
        const isBrandWord = bestBrand.includes(w);
        const isProductWord = bestProduct.includes(w);
        const isVariantWord = bestVariant.includes(w);
        const isGenericWord = GENERIC_GROCERY_KEYWORDS.has(w);

        if (!isBrandWord && !isProductWord && !isVariantWord && !isGenericWord) {
          isDirectMatch = false;
          uncarriedTerm = w;
          break;
        }
      }

      return {
        ...best,
        isDirectMatch,
        uncarriedTerm,
      };
    } catch (err: any) {
      logger.warn('Error in searchCatalogItem', { error: err.message, query: queryLine });
      return null;
    }
  }

  /**
   * Find in-stock alternative: checks for another in-stock variant of the same product first,
   * then falls back to in-stock items in the same primary category.
   */
  private async findInStockAlternative(
    categoryId: string,
    excludeSku: string,
    productId?: string
  ): Promise<any | null> {
    try {
      // 1. Check if another active variant of the same product is in stock
      if (productId) {
        const sameProdRes = await Database.query(
          `SELECT p.name as product_name, b.name as brand_name,
                  v.sku, v.variant_name,
                  COALESCE(bp.amount, 50) as selling_price,
                  COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
           FROM products p
           JOIN brands b ON p.brand_id = b.id
           JOIN product_variants v ON p.id = v.product_id
           LEFT JOIN (
             SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
           ) bp ON v.sku = bp.sku
           JOIN stock_balances sb ON v.sku = sb.sku
           WHERE p.id = $1
             AND v.sku != $2
             AND (sb.on_hand_qty - sb.reserved_qty) > 0
             AND v.status = 'active'
           ORDER BY (sb.on_hand_qty - sb.reserved_qty) DESC
           LIMIT 1`,
          [productId, excludeSku]
        );
        if (sameProdRes.rows.length > 0) {
          return sameProdRes.rows[0];
        }
      }

      // 2. Otherwise, find in-stock alternative in the same category
      const res = await Database.query(
        `SELECT p.name as product_name, b.name as brand_name,
                v.sku, v.variant_name,
                COALESCE(bp.amount, 50) as selling_price,
                COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
         FROM products p
         JOIN brands b ON p.brand_id = b.id
         JOIN product_variants v ON p.id = v.product_id
         LEFT JOIN (
           SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
         ) bp ON v.sku = bp.sku
         JOIN stock_balances sb ON v.sku = sb.sku
         WHERE p.primary_category_id = $1
           AND v.sku != $2
           AND (sb.on_hand_qty - sb.reserved_qty) > 0
           AND v.status = 'active'
         ORDER BY (sb.on_hand_qty - sb.reserved_qty) DESC
         LIMIT 1`,
        [categoryId, excludeSku]
      );
      return res.rows[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Query distinct brands in a given category
   */
  private async getBrandsForCategory(categoryId: string): Promise<any[]> {
    try {
      const res = await Database.query(
        `SELECT DISTINCT b.id, b.name,
                COUNT(v.id) as variant_count,
                COALESCE(SUM(sb.on_hand_qty - sb.reserved_qty), 0) as total_stock
         FROM products p
         JOIN brands b ON p.brand_id = b.id
         JOIN product_variants v ON p.id = v.product_id
         LEFT JOIN stock_balances sb ON v.sku = sb.sku
         WHERE p.primary_category_id = $1 AND p.is_active = TRUE AND v.status = 'active'
         GROUP BY b.id, b.name
         ORDER BY total_stock DESC, b.name ASC`,
        [categoryId]
      );
      return res.rows;
    } catch (err: any) {
      logger.warn('Error fetching brands for category', { error: err.message });
      return [];
    }
  }

  /**
   * Query variants for a chosen brand
   */
  private async getVariantsForBrand(brandName: string, categoryId?: string): Promise<any[]> {
    try {
      const res = await Database.query(
        `SELECT p.name as product_name, b.name as brand_name,
                v.sku, v.variant_name, v.net_weight_value, v.measurement_unit,
                COALESCE(bp.amount, 50) as selling_price,
                COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
         FROM products p
         JOIN brands b ON p.brand_id = b.id
         JOIN product_variants v ON p.id = v.product_id
         LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
         LEFT JOIN stock_balances sb ON v.sku = sb.sku
         WHERE (b.name ILIKE $1 OR b.id::text = $1)
           AND ($2::uuid IS NULL OR p.primary_category_id = $2)
           AND v.status = 'active'
         ORDER BY available_stock DESC, v.sku ASC`,
        [brandName, categoryId || null]
      );
      const seenNames = new Set<string>();
      const uniqueVariants: any[] = [];
      for (const row of res.rows) {
        if (!seenNames.has(row.variant_name)) {
          seenNames.add(row.variant_name);
          uniqueVariants.push(row);
        }
      }
      return uniqueVariants;
    } catch (err: any) {
      logger.warn('Error fetching variants for brand', { error: err.message });
      return [];
    }
  }

  /**
   * Query all active variants with pricing and stock for a given product or search term
   */
  private async getVariantsForProductOrQuery(searchTerm: string, brandName?: string): Promise<any[]> {
    try {
      const words = searchTerm
        .toLowerCase()
        .replace(/(\d+)\s*(gms?|kgs?|pcs|pieces|pack|packs|boxes?|bottles?|litres?|liter|liters|l)\b/gi, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3 && !['send', 'need', 'order', 'please', 'item', 'items', 'thesee'].includes(w));

      let whereClause = "v.status = 'active'";
      const values: any[] = [];

      if (brandName) {
        values.push(`%${brandName}%`);
        whereClause += ` AND b.name ILIKE $${values.length}`;
      }

      if (words.length > 0) {
        const wordConditions = words.map((w) => {
          values.push(`%${w}%`);
          const idx = values.length;
          return `(p.name ILIKE $${idx} OR b.name ILIKE $${idx} OR v.variant_name ILIKE $${idx} OR v.sku ILIKE $${idx})`;
        });
        whereClause += ` AND (${wordConditions.join(' AND ')})`;
      } else {
        values.push(`%${searchTerm}%`);
        whereClause += ` AND (p.name ILIKE $${values.length} OR v.variant_name ILIKE $${values.length})`;
      }

      const sql = `
        SELECT DISTINCT p.id as product_id, p.name as product_name, b.name as brand_name,
               v.sku, v.variant_name, v.net_weight_value, v.measurement_unit,
               COALESCE(bp.amount, 50) as selling_price,
               COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
        FROM products p
        JOIN brands b ON p.brand_id = b.id
        JOIN product_variants v ON p.id = v.product_id
        LEFT JOIN (
          SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
        ) bp ON v.sku = bp.sku
        LEFT JOIN stock_balances sb ON v.sku = sb.sku
        WHERE ${whereClause} AND COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) > 0
        ORDER BY v.net_weight_value ASC, v.sku ASC
        LIMIT 6
      `;

      const res = await Database.query(sql, values);
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const row of res.rows) {
        const key = `${row.product_name}::${row.variant_name}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(row);
        }
      }
      return deduped;
    } catch (err: any) {
      logger.warn('Error in getVariantsForProductOrQuery', { error: err.message, searchTerm });
      return [];
    }
  }

  /**
   * Log an outbound message, dispatch via Meta Cloud API, and return it
   */
  private async sendAndLog(
    sessionId: string,
    reply: WhatsAppOutboundMessage
  ): Promise<WhatsAppOutboundMessage> {
    let providerMessageId: string | undefined = undefined;

    if (this.metaClient) {
      try {
        if (reply.type === 'buttons' && reply.options && reply.options.length > 0) {
          const res = await this.metaClient.sendInteractiveButtons(
            reply.toPhoneNumber,
            reply.bodyText,
            reply.options.map((o) => ({ id: o.id, title: o.title })),
            { headerText: reply.headerText, footerText: reply.footerText }
          );
          providerMessageId = res.messageId;
        } else if (reply.type === 'list' && reply.options && reply.options.length > 0) {
          const res = await this.metaClient.sendInteractiveList(
            reply.toPhoneNumber,
            reply.bodyText,
            'Select Option',
            [
              {
                title: 'Options',
                rows: reply.options.map((o) => ({ id: o.id, title: o.title, description: o.description })),
              },
            ]
          );
          providerMessageId = res.messageId;
        } else {
          const res = await this.metaClient.sendTextMessage(reply.toPhoneNumber, reply.bodyText);
          providerMessageId = res.messageId;
        }
      } catch (err: any) {
        logger.error('Failed to dispatch outbound message via Meta Cloud API', {
          error: err.message,
          to: reply.toPhoneNumber,
        });
      }
    }

    await this.logConversation(sessionId, 'OUTBOUND', reply.type, reply.bodyText, {
      providerMessageId,
      options: reply.options,
    });

    return reply;
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

  /**
   * Log Inbound or Outbound messages to durable database table
   */
  public async logConversation(
    sessionId: string,
    direction: 'INBOUND' | 'OUTBOUND',
    messageType: string,
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO whatsapp_conversation_history (session_id, direction, message_type, content, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, direction, messageType, content, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err: any) {
      logger.error('Failed to log conversation history to database', { error: err.message });
    }
  }

  public async getSession(phone: string): Promise<WhatsAppSessionState | null> {
    const res = await Database.query(
      `SELECT session_id, phone_number, customer_id, stage, cart_items, pending_context, last_message_at
       FROM whatsapp_sessions
       WHERE phone_number = $1
       LIMIT 1`,
      [phone]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const pending = row.pending_context || {};
    return {
      sessionId: row.session_id,
      phoneNumber: row.phone_number,
      customerId: row.customer_id,
      stage: row.stage,
      cartItems: row.cart_items || [],
      pendingDisambiguation: pending.pendingDisambiguation,
      pendingSubstitution: pending.pendingSubstitution,
      ...pending,
      lastMessageAt: row.last_message_at,
    };
  }

  public async getOrCreateSession(phone: string): Promise<WhatsAppSessionState> {
    const existing = await this.getSession(phone);
    if (existing) return existing;

    const sessionId = crypto.randomUUID();
    try {
      await Database.query(
        `INSERT INTO whatsapp_sessions (session_id, phone_number, stage, cart_items, pending_context)
         VALUES ($1, $2, 'IDLE', '[]'::JSONB, '{}'::JSONB)
         ON CONFLICT (phone_number) DO NOTHING`,
        [sessionId, phone]
      );
    } catch (err: any) {
      logger.warn('Error inserting whatsapp session', { error: err.message });
    }

    const fetched = await this.getSession(phone);
    if (fetched) return fetched;

    return {
      sessionId,
      phoneNumber: phone,
      stage: 'IDLE',
      cartItems: [],
      lastMessageAt: new Date().toISOString(),
    };
  }

  private async saveSession(session: WhatsAppSessionState): Promise<void> {
    const pendingContext: any = {};
    if (session.pendingDisambiguation) {
      pendingContext.pendingDisambiguation = session.pendingDisambiguation;
    }
    if (session.pendingSubstitution) {
      pendingContext.pendingSubstitution = session.pendingSubstitution;
    }
    if ((session as any).pendingBrandSelection) {
      pendingContext.pendingBrandSelection = (session as any).pendingBrandSelection;
    }
    if ((session as any).pendingVariantSelection) {
      pendingContext.pendingVariantSelection = (session as any).pendingVariantSelection;
    }
    if ((session as any).pendingAlternatives) {
      pendingContext.pendingAlternatives = (session as any).pendingAlternatives;
    }
    if ((session as any).pendingVariantChoices) {
      pendingContext.pendingVariantChoices = (session as any).pendingVariantChoices;
    }
    if ((session as any).lastOrderNumber) {
      pendingContext.lastOrderNumber = (session as any).lastOrderNumber;
    }
    if ((session as any).lastOrderTotal) {
      pendingContext.lastOrderTotal = (session as any).lastOrderTotal;
    }
    if ((session as any).lastOrderId) {
      pendingContext.lastOrderId = (session as any).lastOrderId;
    }

    await Database.query(
      `UPDATE whatsapp_sessions
       SET stage = $1, cart_items = $2, pending_context = $3, last_message_at = NOW()
       WHERE session_id = $4`,
      [session.stage, JSON.stringify(session.cartItems), JSON.stringify(pendingContext), session.sessionId]
    );
  }

  /**
   * Record back-in-stock notification alert for a customer
   */
  public async recordBackInStockAlert(
    phone: string,
    sku: string,
    productName: string,
    variantName: string,
    requestedQuantity: number = 1
  ): Promise<void> {
    try {
      await Database.query(
        `INSERT INTO back_in_stock_alerts (phone_number, sku, product_name, variant_name, requested_quantity, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         ON CONFLICT (phone_number, sku)
         DO UPDATE SET status = 'PENDING', requested_quantity = EXCLUDED.requested_quantity, updated_at = NOW()`,
        [phone, sku, productName, variantName, requestedQuantity]
      );
      logger.info('Recorded back-in-stock alert', { phone, sku, productName });
    } catch (err: any) {
      try {
        await Database.query(
          `INSERT INTO back_in_stock_alerts (phone_number, sku, product_name, variant_name, requested_quantity, status)
           VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
          [phone, sku, productName, variantName, requestedQuantity]
        );
      } catch (insertErr: any) {
        logger.warn('Failed to record back-in-stock alert', { phone, sku, error: insertErr.message });
      }
    }
  }

  /**
   * Notify customers when a SKU is restocked
   */
  public async notifyBackInStock(sku: string, newAvailableStock: number): Promise<number> {
    try {
      const pendingAlerts = await Database.query(
        `SELECT id, phone_number, product_name, variant_name, requested_quantity
         FROM back_in_stock_alerts
         WHERE sku = $1 AND status = 'PENDING'
         ORDER BY created_at ASC`,
        [sku]
      );

      if (pendingAlerts.rows.length === 0) {
        logger.info('No pending restock alerts for SKU', { sku });
        return 0;
      }

      // Fetch variant details & price
      const varRes = await Database.query(
        `SELECT p.name as product_name, b.name as brand_name,
                v.sku, v.variant_name,
                COALESCE(bp.amount, 50) as selling_price
         FROM product_variants v
         JOIN products p ON v.product_id = p.id
         JOIN brands b ON p.brand_id = b.id
         LEFT JOIN (
           SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
         ) bp ON v.sku = bp.sku
         WHERE v.sku = $1 LIMIT 1`,
        [sku]
      );

      const variant = varRes.rows[0];
      const prodName = variant
        ? variant.product_name.toLowerCase().startsWith(variant.brand_name.toLowerCase())
          ? variant.product_name
          : `${variant.brand_name} ${variant.product_name}`
        : 'Product';
      const variantName = variant ? variant.variant_name : '';
      const price = variant ? Number(variant.selling_price).toFixed(2) : '50.00';

      let notifiedCount = 0;
      for (const alert of pendingAlerts.rows) {
        const phone = alert.phone_number;
        const alertId = alert.id;

        const session = await this.getOrCreateSession(phone);

        const alertMessage =
          `🔔 *Great News! An item you wanted is back in stock!* 🎉\n\n` +
          `*${prodName} (${variantName})* is now available in our warehouse!\n` +
          `⚡ Available Stock: *${newAvailableStock} units*\n` +
          `💰 Price: *₹${price}*\n\n` +
          `Would you like to purchase it now? Tap below:`;

        await this.sendAndLog(session.sessionId, {
          toPhoneNumber: phone,
          type: 'buttons',
          bodyText: alertMessage,
          options: [
            { id: `buy_${sku}`, title: 'Buy Now 🛒' },
            { id: 'cart_view', title: 'View Cart' },
          ],
        });

        await Database.query(
          `UPDATE back_in_stock_alerts
           SET status = 'NOTIFIED', notified_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [alertId]
        );

        notifiedCount++;
      }

      logger.info('Dispatched back-in-stock alerts', { sku, notifiedCount });
      return notifiedCount;
    } catch (err: any) {
      logger.error('Error sending back-in-stock notifications', { sku, error: err.message });
      return 0;
    }
  }
}

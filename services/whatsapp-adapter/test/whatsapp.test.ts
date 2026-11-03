import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WhatsAppBot } from '../src/whatsapp.bot.js';
import { WhatsAppCloudApiClient } from '../src/meta.client.js';
import { SignatureVerifier } from '../src/signature.verifier.js';
import { Database } from '../src/db.js';
import crypto from 'node:crypto';

describe('WhatsApp Adapter - Conversational Engine & Acceptance Scenarios', () => {
  it('Scenario 8: Deduplicates Repeated Provider Webhook Deliveries', async () => {
    const processedMessages = new Set<string>();

    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO whatsapp_processed_messages')) {
        const msgId = params![0];
        if (processedMessages.has(msgId)) {
          const err: any = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        processedMessages.add(msgId);
        return { rows: [] } as any;
      }
      if (sql.includes('FROM whatsapp_sessions')) {
        return { rows: [] } as any;
      }
      if (sql.includes('INSERT INTO whatsapp_sessions')) {
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    };

    const mockCatalog = {
      disambiguate: async () => ({ isAmbiguous: false, query: 'hi', matchingCategories: [] }),
      searchProducts: async () => ({ items: [] }),
      getSimilarAlternatives: async () => null,
    };
    const mockPricing = { calculateQuote: async () => ({} as any) };
    const mockOrder = { checkout: async () => ({} as any) };

    try {
      const bot = new WhatsAppBot(mockCatalog, mockPricing, mockOrder);

      // First delivery: processes successfully
      const reply1 = await bot.handleInboundMessage({
        messageId: 'wamid.HBgLMTAwMDAwMDAwMDU',
        fromPhoneNumber: '+919876543210',
        text: 'hello',
        timestamp: '1700000000',
      });
      assert.ok(reply1);

      // Second delivery with identical messageId: deduplicated, returns null!
      const reply2 = await bot.handleInboundMessage({
        messageId: 'wamid.HBgLMTAwMDAwMDAwMDU',
        fromPhoneNumber: '+919876543210',
        text: 'hello',
        timestamp: '1700000000',
      });
      assert.equal(reply2, null);
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Scenario 9: Ambiguous Product Request asks for Category Clarification with Interactive Buttons', async () => {
    const originalQuery = Database.query;
    Database.query = async (sql: string) => {
      if (sql.includes('INSERT INTO whatsapp_processed_messages')) return { rows: [] } as any;
      if (sql.includes('FROM whatsapp_sessions')) return { rows: [] } as any;
      if (sql.includes('INSERT INTO whatsapp_sessions')) return { rows: [] } as any;
      if (sql.includes('UPDATE whatsapp_sessions')) return { rows: [] } as any;
      return { rows: [] } as any;
    };

    const mockCatalog = {
      disambiguate: async (term: string) => {
        if (term.toLowerCase() === 'soap') {
          return {
            query: 'soap',
            isAmbiguous: true,
            matchingCategories: [
              { id: 'cat-1', name: 'Bathing Soaps & Body Wash', slug: 'bathing', sampleBrands: ['Dove', 'Dettol'] },
              { id: 'cat-2', name: 'Washing Soaps & Detergent Bars', slug: 'washing', sampleBrands: ['Rin', 'Surf Excel'] },
              { id: 'cat-3', name: 'Dishwashing & Utensil Soaps', slug: 'utensils', sampleBrands: ['Vim', 'Exo'] },
            ],
          };
        }
        return { isAmbiguous: false, query: term, matchingCategories: [] };
      },
      searchProducts: async () => ({ items: [] }),
      getSimilarAlternatives: async () => null,
    };
    const mockPricing = { calculateQuote: async () => ({} as any) };
    const mockOrder = { checkout: async () => ({} as any) };

    try {
      const bot = new WhatsAppBot(mockCatalog, mockPricing, mockOrder);
      const reply = await bot.handleInboundMessage({
        messageId: 'wamid.unique.soap.001',
        fromPhoneNumber: '+919876543210',
        text: 'soap',
        timestamp: '1700000001',
      });

      assert.ok(reply);
      // Confirms interactive button options are populated
      assert.equal(reply?.type, 'buttons');
      assert.equal(reply?.options?.length, 3);
      assert.equal(reply?.options?.[0].id, 'cat_1');
      assert.ok(reply?.bodyText.includes('Bathing Soaps'));
      assert.ok(reply?.bodyText.includes('Washing Soaps'));
      assert.ok(reply?.bodyText.includes('Dishwashing & Utensil Soaps'));
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Scenario 10: Explicit Customer Confirmation Required for Substitutions via Interactive Buttons', async () => {
    let sessionStage = 'AWAITING_SUBSTITUTION_APPROVAL';
    let pendingSub: any = {
      orderId: 'ORD-8921',
      originalSku: 'BRIT-BRD-400G',
      originalProductName: 'Britannia 100% Whole Wheat Bread (400g)',
      proposedSku: 'HEALTH-BRD-400G',
      proposedProductName: 'The Health Factory Zero Maida Bread (400g)',
      priceDifference: 10.0,
    };

    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('INSERT INTO whatsapp_processed_messages')) return { rows: [] } as any;
      if (sql.includes('FROM whatsapp_sessions')) {
        return {
          rows: [
            {
              session_id: 'sess-sub-01',
              phone_number: '+919876543210',
              stage: sessionStage,
              cart_items: [],
              pending_context: { pendingSubstitution: pendingSub },
              last_message_at: new Date().toISOString(),
            },
          ],
        } as any;
      }
      if (sql.includes('UPDATE whatsapp_sessions')) {
        sessionStage = params![0];
        pendingSub = undefined;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    };

    const mockCatalog = {
      disambiguate: async () => ({ isAmbiguous: false, query: '', matchingCategories: [] }),
      searchProducts: async () => ({ items: [] }),
      getSimilarAlternatives: async () => null,
    };
    const mockPricing = { calculateQuote: async () => ({} as any) };
    const mockOrder = { checkout: async () => ({} as any) };

    try {
      const bot = new WhatsAppBot(mockCatalog, mockPricing, mockOrder);

      // Customer sends button click with id 'sub_accept'
      const reply = await bot.handleInboundMessage({
        messageId: 'wamid.sub.accept.001',
        fromPhoneNumber: '+919876543210',
        text: 'sub_accept',
        timestamp: '1700000002',
      });

      assert.ok(reply);
      assert.ok(reply?.bodyText.includes('Substitution approved'));
      assert.ok(reply?.bodyText.includes('The Health Factory Zero Maida Bread'));
      assert.equal(sessionStage, 'IDLE');
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Verifies Meta HMAC-SHA256 Webhook Signatures (Security by Default)', () => {
    const appSecret = 'super_secret_whatsapp_app_token_999';
    const payload = JSON.stringify({ entry: [{ id: '12345' }] });

    // Generate valid HMAC
    const validHmac = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
    const validHeader = `sha256=${validHmac}`;

    // Verify valid signature passes
    const isValid = SignatureVerifier.verifyMetaSignature(payload, validHeader, appSecret);
    assert.equal(isValid, true);

    // Verify tampered signature fails
    const isTampered = SignatureVerifier.verifyMetaSignature(
      payload + 'tampered',
      validHeader,
      appSecret
    );
    assert.equal(isTampered, false);

    // Verify missing signature fails
    assert.equal(SignatureVerifier.verifyMetaSignature(payload, undefined, appSecret), false);
  });

  it('Meta WhatsApp Cloud API Client dispatches formatted interactive buttons and text', async () => {
    const client = new WhatsAppCloudApiClient({
      accessToken: 'test_token',
      phoneNumberId: '1000999888',
    });
    assert.equal(client.isConfigured(), true);

    // Test unconfigured mock mode
    const mockClient = new WhatsAppCloudApiClient();
    const res = await mockClient.sendInteractiveButtons('+919876543210', 'Choose Soap', [
      { id: 'btn_1', title: 'Bathing Soap' },
      { id: 'btn_2', title: 'Detergent' },
    ]);

    assert.equal(res.success, true);
    assert.equal(res.mock, true);
    assert.ok(res.messageId.startsWith('wamid.'));
  });

  it('Feature 1: Transcribes voice notes and normalizes Hindi/Hinglish grocery terms', async () => {
    const { AudioTranscriptionService } = await import('../src/transcription.service.js');
    const service = new AudioTranscriptionService();

    // 1. Test Hinglish term normalization
    const normalized = service.normalizeHinglishGroceryTerms('Do packet doodh aur ek kilo makhan de do');
    assert.ok(normalized.includes('2 packet milk'));
    assert.ok(normalized.includes('1 kg butter'));

    // 2. Test audio transcription service
    const transcript = await service.transcribeAudio({
      simulatedTranscript: '2 Amul butter and 1 Britannia bread',
    });
    assert.equal(transcript, '2 Amul butter and 1 Britannia bread');

    // 3. Test Bot handling voice note
    const originalQuery = Database.query;
    Database.query = async (sql: string, params?: any[]) => {
      if (sql.includes('FROM products') || sql.includes('FROM product_variants')) {
        return {
          rows: [
            {
              id: 'p1',
              name: 'Amul Butter',
              product_name: 'Amul Butter',
              brand_name: 'Amul',
              sku: 'DAI-AMU-BUT-500',
              variant_name: '500g',
              selling_price: '275.00',
              available_stock: '40',
              isDirectMatch: true,
            },
            {
              id: 'p2',
              name: 'Britannia White Bread',
              product_name: 'Britannia White Bread',
              brand_name: 'Britannia',
              sku: 'BAK-BRI-BRD-400',
              variant_name: '400g',
              selling_price: '50.00',
              available_stock: '30',
              isDirectMatch: true,
            },
          ],
        } as any;
      }
      return { rows: [] } as any;
    };

    try {
      const mockCatalog = {
        disambiguate: async () => ({ isAmbiguous: false, query: 'test', matchingCategories: [] }),
        searchProducts: async () => ({ items: [] }),
        getSimilarAlternatives: async () => null,
      };
      const mockPricing = { calculateQuote: async () => ({} as any) };
      const mockOrder = { checkout: async () => ({} as any) };

      const bot = new WhatsAppBot(mockCatalog, mockPricing, mockOrder);
      const reply = await bot.handleInboundMessage({
        messageId: `wamid.voice_${Date.now()}`,
        fromPhoneNumber: '+919988776655',
        text: transcript,
        messageType: 'audio',
        isVoiceNote: true,
        timestamp: '1698480000',
      });

      assert.ok(reply !== null);
      assert.ok(reply.bodyText.includes('Voice Note Received'));
    } finally {
      Database.query = originalQuery;
    }
  });

  it('Feature 2: Extracts grocery shopping list items from handwritten note or list OCR', async () => {
    const { VisionOcrService } = await import('../src/ocr.service.js');
    const ocrService = new VisionOcrService();

    const note = `
    1. 2 kg Aashirvaad Shudh Chakki Atta
    2. 1L Amul Taaza Milk
    3. 500g Fresh Malai Paneer
    4. 6 pcs Bananas
    `;

    const result = await ocrService.extractShoppingListFromImage({
      simulatedNoteText: note,
    });

    assert.equal(result.items.length, 4);
    assert.equal(result.items[0].quantity, 2);
    assert.equal(result.items[0].unit, 'kg');
    assert.ok(result.items[0].item.includes('Atta'));

    assert.equal(result.items[1].quantity, 1);
    assert.equal(result.items[1].unit, 'l');

    assert.equal(result.items[2].quantity, 500);
    assert.equal(result.items[2].unit, 'g');

    // Test Bot rendering with OCR photo message
    const originalQuery = Database.query;
    Database.query = async (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('FROM products p')) {
        return {
          rows: [
            {
              product_id: 'prod-atta',
              product_name: 'Aashirvaad Shudh Chakki Atta',
              brand: 'Aashirvaad',
              brand_name: 'Aashirvaad',
              category_name: 'Staples & Grains',
              variant_id: 'var-atta-2kg',
              sku: 'SKU-ATTA-2KG',
              variant_name: '2kg',
              price: 120.0,
              stock: 50,
              available_stock: 50,
            },
          ],
        } as any;
      }
      return { rows: [] } as any;
    };

    try {
      const mockCatalog = {
        disambiguate: async () => ({ isAmbiguous: false, query: 'test', matchingCategories: [] }),
        searchProducts: async () => ({ items: [] }),
        getSimilarAlternatives: async () => null,
      };
      const mockPricing = { calculateQuote: async () => ({} as any) };
      const mockOrder = { checkout: async () => ({} as any) };

      const bot = new WhatsAppBot(mockCatalog, mockPricing, mockOrder);
      const reply = await bot.handleInboundMessage({
        messageId: `wamid.ocr_${Date.now()}`,
        fromPhoneNumber: '+919988776655',
        text: '2 kg Aashirvaad Atta',
        messageType: 'image',
        isPhotoOcr: true,
        ocrLines: ['1. 2 kg Aashirvaad Shudh Chakki Atta'],
        timestamp: '1698480000',
      });

      assert.ok(reply !== null);
      assert.ok(reply.bodyText.includes('Shopping List Photo Scanned & Extracted'));
    } finally {
      Database.query = originalQuery;
    }
  });
});

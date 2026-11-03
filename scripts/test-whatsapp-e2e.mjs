import pg from 'pg';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const { Pool } = pg;

const SUPABASE_DATABASE_URL =
  process.env.SUPABASE_DATABASE_URL ||
  'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
const WHATSAPP_URL = process.env.WHATSAPP_ADAPTER_URL || 'http://localhost:3005';

const pool = new Pool({
  connectionString: SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

console.log('========================================================================');
console.log('🧪 WHATSAPP COMMERCE ARCHITECTURE & SUPABASE DATABASE E2E TEST SUITE');
console.log('========================================================================');
console.log(`📡 API Gateway: ${GATEWAY_URL}`);
console.log(`📱 WhatsApp Adapter: ${WHATSAPP_URL}`);
console.log(`🗄️  Supabase DB: ${SUPABASE_DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n`);

async function run() {
  const testPhone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  console.log(`👤 Using dynamic test phone number: ${testPhone}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: Meta Webhook Verification Handshake (GET /webhook/whatsapp)
  // -------------------------------------------------------------------------
  console.log('▶ TEST 1: Meta Webhook Handshake Verification (GET)');
  {
    const challengeVal = `chal_${Date.now()}`;
    const url = `${GATEWAY_URL}/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test_verify_token&hub.challenge=${challengeVal}`;
    const res = await fetch(url);
    const bodyText = await res.text();
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.equal(bodyText, challengeVal, `Challenge token should match`);
    console.log(`  ✅ Meta verification handshake succeeded. Challenge echo: ${bodyText}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Provider Inbound Webhook & Deduplication (Scenario 8)
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 2: Scenario 8: Provider Webhook Inbound Delivery & Deduplication Gate');
  const messageId = `wamid.TEST_${Date.now()}_ABC123`;
  {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: testPhone,
                    id: messageId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Hello Store!' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    // First delivery (Through API Gateway)
    const res1 = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res1.status, 200, `First delivery should return 200`);
    console.log(`  ✅ First webhook delivery acknowledged with 200 OK`);

    // Give DB 100ms to persist
    await new Promise((r) => setTimeout(r, 100));

    // Verify row in Supabase whatsapp_processed_messages
    const dbCheck1 = await pool.query(
      `SELECT message_id, from_phone, processed_at FROM whatsapp_processed_messages WHERE message_id = $1`,
      [messageId]
    );
    assert.equal(dbCheck1.rows.length, 1, `Message ID should be recorded in whatsapp_processed_messages`);
    assert.equal(dbCheck1.rows[0].from_phone, testPhone);
    console.log(`  ✅ Database Entry Confirmed in Supabase [whatsapp_processed_messages]:`, {
      message_id: dbCheck1.rows[0].message_id,
      from_phone: dbCheck1.rows[0].from_phone,
      processed_at: dbCheck1.rows[0].processed_at,
    });

    // Second delivery with identical provider message ID (Retransmission)
    const res2 = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res2.status, 200, `Deduplicated delivery should also return 200 OK`);

    // Verify no duplicate row created
    const dbCheck2 = await pool.query(
      `SELECT count(*)::int as count FROM whatsapp_processed_messages WHERE message_id = $1`,
      [messageId]
    );
    assert.equal(dbCheck2.rows[0].count, 1, `Dedup count must remain exactly 1`);
    console.log(`  ✅ Deduplication successfully prevented duplicate processing in Supabase.`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Scenario 9: Ambiguous Product Request Category Disambiguation ("soap")
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 3: Scenario 9: Ambiguous Search Query Disambiguation ("soap")');
  {
    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: 'soap',
      }),
    });
    const json = await res.json();
    assert.ok(json.success || json.ok, `Chat response should be ok`);
    const reply = json.data.reply;
    console.log(`  💬 WhatsApp Bot Reply:\n${reply.split('\n').map(l => '     ' + l).join('\n')}`);

    // Verify reply contains the 3 required categories
    assert.ok(reply.includes('Bathing Soaps'), `Must prompt for Bathing Soaps`);
    assert.ok(reply.includes('Washing Soaps'), `Must prompt for Washing Soaps`);
    assert.ok(reply.includes('Dishwashing'), `Must prompt for Dishwashing`);

    // Verify session state in Supabase
    const sessionRes = await pool.query(
      `SELECT stage, pending_context FROM whatsapp_sessions WHERE phone_number = $1`,
      [testPhone]
    );
    assert.equal(sessionRes.rows.length, 1);
    assert.equal(sessionRes.rows[0].stage, 'DISAMBIGUATING_CATEGORY');
    assert.ok(sessionRes.rows[0].pending_context?.pendingDisambiguation);
    console.log(`  ✅ Supabase Session State Verified: stage = DISAMBIGUATING_CATEGORY`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Category Selection & Catalog Product Listing
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 4: Customer selects category "1" (Bathing Soaps)');
  {
    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: '1',
      }),
    });
    const json = await res.json();
    const reply = json.data.reply;
    console.log(`  💬 WhatsApp Bot Reply:\n${reply.split('\n').map(l => '     ' + l).join('\n')}`);

    assert.ok(reply.includes('Dettol') || reply.includes('Dove'), `Should return Bathing Soap products`);

    // Verify session state updated (either drilldown SELECTING_BRAND or IDLE)
    const sessionRes = await pool.query(
      `SELECT stage FROM whatsapp_sessions WHERE phone_number = $1`,
      [testPhone]
    );
    assert.ok(['SELECTING_BRAND', 'IDLE'].includes(sessionRes.rows[0].stage));
    console.log(`  ✅ Supabase Session Stage verified: ${sessionRes.rows[0].stage}`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Cart Management & Database Persistence
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 5: Adding item to WhatsApp cart ("ADD DOVE")');
  {
    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: 'ADD DOVE',
      }),
    });
    const json = await res.json();
    const reply = json.data.reply;
    console.log(`  💬 WhatsApp Bot Reply:\n     ${reply.replace(/\n/g, '\n     ')}`);

    assert.ok(reply.includes('Added') && reply.includes('Dove'), `Should confirm Dove added`);

    // Verify cart_items in Supabase whatsapp_sessions
    const sessionRes = await pool.query(
      `SELECT cart_items FROM whatsapp_sessions WHERE phone_number = $1`,
      [testPhone]
    );
    const cart = sessionRes.rows[0].cart_items;
    assert.equal(cart.length, 1, `Cart in database should have 1 item`);
    assert.ok(cart[0].sku.includes('DOVE') || cart[0].productName.includes('Dove'));
    console.log(`  ✅ Supabase Cart Items in Database:`, cart);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Checkout Saga Triggering from WhatsApp -> Real Database Order & Inventory Reservation
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 6: WhatsApp Checkout ("Confirm") -> Checkout Saga Execution in Supabase');
  let orderNumber = '';
  {
    // Check initial stock for Dove in Supabase
    const initialStockRes = await pool.query(
      `SELECT on_hand_qty, reserved_qty FROM stock_balances WHERE sku = 'DOVE-BAR-75G'`
    );
    const initStock = initialStockRes.rows[0];
    const initialReserved = parseFloat(initStock.reserved_qty);
    console.log(`  📦 Initial Stock in Supabase: on_hand=${initStock.on_hand_qty}, reserved=${initStock.reserved_qty}`);

    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: 'Confirm',
      }),
    });
    const json = await res.json();
    const reply = json.data.reply;
    console.log(`  💬 WhatsApp Bot Reply:\n${reply.split('\n').map(l => '     ' + l).join('\n')}`);

    assert.ok(reply.includes('Order ORD-'), `Reply should include confirmed Order Number`);
    assert.ok(reply.includes('Grand Total: ₹'), `Reply should include computed Grand Total`);
    assert.ok(reply.includes('checkout') || reply.includes('pay.groceryplatform.com'), `Reply should include checkout link`);

    // Extract Order Number
    const match = reply.match(/Order (ORD-[0-9\-]+)/);
    assert.ok(match, `Should match order number`);
    orderNumber = match[1];
    console.log(`  🎯 Created Order Number: ${orderNumber}`);

    // Verify order in Supabase orders table
    const orderRes = await pool.query(
      `SELECT id, order_number, channel, customer_id, subtotal, tax_total, grand_total, status, reservation_id
       FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    assert.equal(orderRes.rows.length, 1, `Order must exist in Supabase orders table`);
    const dbOrder = orderRes.rows[0];
    assert.equal(dbOrder.channel, 'WHATSAPP');
    console.log(`  ✅ Supabase Order Verified in Database:`, {
      id: dbOrder.id,
      order_number: dbOrder.order_number,
      channel: dbOrder.channel,
      grand_total: `₹${parseFloat(dbOrder.grand_total).toFixed(2)}`,
      status: dbOrder.status,
      reservation_id: dbOrder.reservation_id,
    });

    // Verify order line items in Supabase order_items table
    const itemsRes = await pool.query(
      `SELECT sku, product_name, quantity, unit_price, net_amount FROM order_items WHERE order_id = $1`,
      [dbOrder.id]
    );
    assert.ok(itemsRes.rows.length > 0, `Order must have line items in Supabase order_items`);
    console.log(`  ✅ Supabase Order Line Items:`, itemsRes.rows);

    // Verify inventory reservation in Supabase stock_balances
    const finalStockRes = await pool.query(
      `SELECT on_hand_qty, reserved_qty FROM stock_balances WHERE sku = 'DOVE-BAR-75G'`
    );
    const finalStock = finalStockRes.rows[0];
    const finalReserved = parseFloat(finalStock.reserved_qty);
    console.log(`  📦 Reserved Stock in Supabase after WhatsApp Order: on_hand=${finalStock.on_hand_qty}, reserved=${finalStock.reserved_qty}`);
    assert.equal(
      finalReserved,
      initialReserved + 1,
      `Reserved quantity in Supabase must increase by 1`
    );
    console.log(`  ✅ Supabase Inventory Lock Confirmed! 1 unit reserved.`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Scenario 10: Explicit Substitution Confirmation Flow
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 7: Scenario 10: Substitution Approval Flow');
  {
    // Simulate picker proposing substitution in Supabase
    await pool.query(
      `UPDATE whatsapp_sessions
       SET stage = 'AWAITING_SUBSTITUTION_APPROVAL',
           pending_context = $1
       WHERE phone_number = $2`,
      [
        JSON.stringify({
          pendingSubstitution: {
            orderId: orderNumber,
            originalSku: 'BRIT-BRD-400G',
            originalProductName: 'Britannia 100% Whole Wheat Bread (400g)',
            proposedSku: 'HEALTH-BRD-400G',
            proposedProductName: 'The Health Factory Zero Maida Bread (400g)',
            priceDifference: 10.0,
          },
        }),
        testPhone,
      ]
    );

    // Customer accepts proposal via WhatsApp
    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: 'Accept substitution',
      }),
    });
    const json = await res.json();
    const reply = json.data.reply;
    console.log(`  💬 WhatsApp Bot Reply:\n     ${reply.replace(/\n/g, '\n     ')}`);

    assert.ok(reply.includes('Substitution approved'), `Should confirm substitution approval`);
    assert.ok(reply.includes('The Health Factory Zero Maida Bread'), `Should name proposed product`);

    // Verify session stage returned to IDLE in Supabase
    const sessionRes = await pool.query(
      `SELECT stage, pending_context FROM whatsapp_sessions WHERE phone_number = $1`,
      [testPhone]
    );
    assert.equal(sessionRes.rows[0].stage, 'IDLE');
    console.log(`  ✅ Supabase Session Transition: Stage returned to IDLE`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Full Conversation History in Supabase Database
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 8: Inspect Durable Conversation History in Supabase [whatsapp_conversation_history]');
  {
    const historyRes = await pool.query(
      `SELECT h.direction, h.message_type, h.content, h.created_at
       FROM whatsapp_conversation_history h
       JOIN whatsapp_sessions s ON h.session_id = s.session_id
       WHERE s.phone_number = $1
       ORDER BY h.created_at ASC`,
      [testPhone]
    );

    console.log(`  📜 Total conversation log entries stored in Supabase: ${historyRes.rows.length}`);
    assert.ok(historyRes.rows.length >= 8, `Should have stored at least 8 chat turns in Supabase`);

    historyRes.rows.forEach((row, idx) => {
      const dirIcon = row.direction === 'INBOUND' ? '👤 IN ' : '🤖 OUT';
      const preview = row.content.replace(/\n/g, ' ').substring(0, 70);
      console.log(`     ${idx + 1}. [${dirIcon}] ${preview}...`);
    });
    console.log(`  ✅ All conversation turns successfully verified in Supabase!`);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Store Admin Web WhatsApp History API Endpoint Verification
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 9: Fetch Session & Chat History via Gateway Endpoint');
  {
    const encodedPhone = encodeURIComponent(testPhone);
    const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/sessions/${encodedPhone}`);
    const json = await res.json();
    assert.ok(json.success || json.ok, `API response should be ok`);
    assert.ok(json.data.session, `Session data should exist`);
    assert.ok(json.data.history.length > 0, `History array should be populated`);
    console.log(`  ✅ Gateway Endpoint /api/v1/whatsapp/sessions/:phone verified (${json.data.history.length} messages)`);
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL WHATSAPP COMMERCE ARCHITECTURE & SUPABASE DATABASE CHECKS PASSED!');
  console.log('========================================================================');
  await pool.end();
}

run().catch(async (err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  await pool.end();
  process.exit(1);
});

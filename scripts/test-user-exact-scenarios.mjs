import assert from 'node:assert/strict';

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

async function sendChat(phone, message) {
  const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, message }),
  });
  const json = await res.json();
  return json.data;
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 VERIFYING USER EXACT SCENARIOS (DRILLDOWN & GROCERY LIST PARSER)');
  console.log('========================================================================\n');

  const testPhoneA = `+9199100${Math.floor(10000 + Math.random() * 90000)}`;
  const testPhoneB = `+9199200${Math.floor(10000 + Math.random() * 90000)}`;

  // =========================================================================
  // SCENARIO 1: SOAP MULTI-LEVEL DRILLDOWN (Category -> Brand -> Variant)
  // =========================================================================
  console.log('▶ SCENARIO 1: Soap Multi-Level Drilldown (Category -> Brand -> Variant -> Cart)');
  console.log(`👤 Customer ${testPhoneA} asks: "soap"`);
  const step1 = await sendChat(testPhoneA, 'soap');
  console.log('💬 Bot Reply (Level 1: Categories):');
  console.log(step1.reply);
  console.log('Options:', step1.outboundMessage?.options);
  assert.ok(step1.reply.includes('Bathing Soaps'));
  assert.ok(step1.reply.includes('Washing Soaps'));
  assert.ok(step1.reply.includes('Dishwashing & Utensil Soaps'));

  console.log('\n👤 Customer selects Bathing Soaps: "1"');
  const step2 = await sendChat(testPhoneA, '1');
  console.log('💬 Bot Reply (Level 2: Brands):');
  console.log(step2.reply);
  console.log('Options:', step2.outboundMessage?.options);
  assert.ok(step2.reply.includes('Dove'));
  assert.ok(step2.reply.includes('Dettol'));
  assert.ok(step2.reply.includes('Pears') || step2.reply.includes('Lux'));

  console.log('\n👤 Customer selects brand: "Dove"');
  const step3 = await sendChat(testPhoneA, 'Dove');
  console.log('💬 Bot Reply (Level 3: Variants / Pack Sizes):');
  console.log(step3.reply);
  console.log('Options:', step3.outboundMessage?.options);
  assert.ok(step3.reply.includes('75 g Single Bar'));
  assert.ok(step3.reply.includes('125 g (Pack of 4)'));

  console.log('\n👤 Customer selects pack size: "1" (75 g Single Bar)');
  const step4 = await sendChat(testPhoneA, '1');
  console.log('💬 Bot Reply (Level 4: Cart Addition Confirmation):');
  console.log(step4.reply);
  assert.ok(step4.reply.includes('Added *Dove Cream Beauty Bathing Bar (75 g Single Bar)*'));
  assert.equal(step4.session.cartItems.length, 1);
  console.log('✅ SCENARIO 1 PASSED: Multi-level soap drilldown completed successfully!\n');

  // =========================================================================
  // SCENARIO 2: MULTI-ITEM GROCERY SHOPPING LIST WITH OUT-OF-STOCK ALTERNATIVES
  // =========================================================================
  console.log('========================================================================');
  console.log('▶ SCENARIO 2: Multi-Item Shopping List with Live Stock & Alternatives');
  console.log('========================================================================');

  const customerShoppingList = `sende me thesee items


1. amul butter 500 gms
2. lux rose soap 3 pcs
3. large sandwitch bread
4. colgate toothpaste 2 pcs
5. hair and care shampoo 200 gms
6. tata salt 500 gms
7. sugar 2 kgs
8. surf excel top laoding poweder 4 kgs`;

  console.log(`👤 Customer ${testPhoneB} sends shopping list:\n${customerShoppingList}\n`);

  const listResponse = await sendChat(testPhoneB, customerShoppingList);
  console.log('💬 Bot Reply (List Breakdown & Alternative Suggestion):');
  console.log(listResponse.reply);
  console.log('Interactive Buttons:', listResponse.outboundMessage?.options);

  // Assert in-stock items were added
  assert.ok(listResponse.reply.includes('Available & Added to Your Cart') || listResponse.reply.includes('Added to Cart'));
  assert.ok(listResponse.reply.includes('Amul Pasteurised Butter'));
  assert.ok(listResponse.reply.includes('Britannia Large Sandwich White Bread'));
  assert.ok(listResponse.reply.includes('Colgate Strong Teeth'));
  assert.ok(listResponse.reply.includes('Hair & Care Triple Blend'));
  assert.ok(listResponse.reply.includes('Tata Salt'));
  assert.ok(listResponse.reply.includes('Madhur Pure'));
  assert.ok(listResponse.reply.includes('Surf Excel Matic Top Load'));

  // Assert out-of-stock item (Lux Rose Soap) triggers alternative
  assert.ok(listResponse.reply.includes('Lux Rose') || listResponse.reply.includes('lux rose soap'));
  assert.ok(listResponse.reply.toLowerCase().includes('out of stock'));
  assert.ok(listResponse.reply.includes('Recommended In-Stock Alternative') || listResponse.reply.includes('Suggested In-Stock Alternative'));

  console.log('\n👤 Customer taps "Accept Alternative"');
  const altAccept = await sendChat(testPhoneB, 'Accept Alternative');
  console.log('💬 Bot Reply (Alternatives Added to Cart):');
  console.log(altAccept.reply);
  assert.ok(altAccept.reply.toLowerCase().includes('added suggested'));

  console.log('\n👤 Customer confirms order: "Confirm"');
  const checkoutResponse = await sendChat(testPhoneB, 'Confirm');
  console.log('💬 Bot Reply (Order Placed & Checkout Saga Completed):');
  console.log(checkoutResponse.reply);
  assert.ok(checkoutResponse.reply.includes('ORD-'));
  assert.ok(checkoutResponse.reply.includes('Grand Total:'));
  assert.ok(checkoutResponse.reply.includes('https://pay.groceryplatform.com'));

  console.log('\n🎉 ALL USER SCENARIOS TESTED AND VERIFIED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

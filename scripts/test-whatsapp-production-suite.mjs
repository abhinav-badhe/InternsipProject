
const BASE_URL = 'http://localhost:3000/api/v1/whatsapp/chat';
const PHONE = '+919988776655'; // Clean test phone number

async function sendMsg(message) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, phoneNumber: PHONE }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`API Error: ${json.error?.message || JSON.stringify(json)}`);
  }
  return {
    reply: json.data?.reply,
    options: json.data?.outboundMessage?.options || [],
    session: json.data?.session,
  };
}

async function run() {
  console.log('=== STARTING COMPREHENSIVE WHATSAPP COMMERCE TEST SUITE ===\n');

  // Step 0: Reset session
  console.log('[STEP 0] Resetting session...');
  const resetRes = await sendMsg('clear');
  console.log('Bot:', resetRes.reply.replace(/\n+/g, ' '));
  console.log('');

  // Step 1: Greeting
  console.log('[STEP 1] Testing Greeting & Onboarding...');
  const greetRes = await sendMsg('Hi');
  console.log('Bot:', greetRes.reply);
  console.log('Options:', greetRes.options.map(o => o.title));
  if (!greetRes.reply.includes('Welcome to FreshCart')) {
    throw new Error('Greeting failed!');
  }
  console.log('✅ Greeting passed!\n');

  // Step 2: Complex 8-item custom grocery list
  console.log('[STEP 2] Testing 8-item custom grocery list...');
  const listMsg = 'sende me thesee items   1. amul butter 500 gms 2. lux rose soap 3 pcs 3. large sandwitch bread 4. colgate toothpaste 2 pcs 5. hair and care shampoo 200 gms 6. tata salt 500 gms 7. sugar 2 kgs 8. surf excel top laoding poweder 4 kgs';
  const listRes = await sendMsg(listMsg);
  console.log('Bot:\n' + listRes.reply);
  console.log('Options:', listRes.options.map(o => o.title));
  if (!listRes.reply.includes('Amul Pasteurised Butter') || !listRes.reply.includes('OUT OF STOCK')) {
    throw new Error('8-item list processing failed!');
  }
  console.log('✅ 8-item list & alternative recommendation passed!\n');

  // Step 3: Accept suggested alternative
  console.log('[STEP 3] Testing Accept Alternative...');
  const altRes = await sendMsg('Accept Alternative');
  console.log('Bot:\n' + altRes.reply);
  if (!altRes.reply.includes('Added Suggested In-Stock Alternatives') || !altRes.reply.includes('8 items')) {
    throw new Error('Accept alternative failed!');
  }
  console.log('✅ Accept alternative passed!\n');

  // Step 4: View cart
  console.log('[STEP 4] Testing View Cart...');
  const cartRes = await sendMsg('view cart');
  console.log('Bot:\n' + cartRes.reply);
  if (!cartRes.reply.includes('Your Current Cart')) {
    throw new Error('View cart failed!');
  }
  console.log('✅ View cart passed!\n');

  // Step 5: Remove an item
  console.log('[STEP 5] Testing Cart Item Removal...');
  const removeRes = await sendMsg('remove 2');
  console.log('Bot:\n' + removeRes.reply);
  if (!removeRes.reply.includes('Removed') || !removeRes.reply.includes('7')) {
    throw new Error('Item removal failed!');
  }
  console.log('✅ Cart item removal passed!\n');

  // Step 6: Single product direct addition
  console.log('[STEP 6] Testing Single Product Addition with Live Price & Stock...');
  const singleRes = await sendMsg('add 1L amul milk');
  console.log('Bot:\n' + singleRes.reply);
  if (!singleRes.reply.includes('Amul') || !singleRes.reply.includes('Price')) {
    throw new Error('Single product addition failed!');
  }
  console.log('✅ Single product addition passed!\n');

  // Step 7: Confirm order (Checkout Saga)
  console.log('[STEP 7] Testing Confirm Order / Checkout Saga...');
  const orderRes = await sendMsg('Confirm Order');
  console.log('Bot:\n' + orderRes.reply);
  if (!orderRes.reply.includes('Order Confirmed & Placed Successfully') || !orderRes.reply.includes('ORD-')) {
    throw new Error('Order checkout failed!');
  }
  const orderNumMatch = orderRes.reply.match(/ORD-\d+-\d+/);
  const orderNum = orderNumMatch ? orderNumMatch[0] : null;
  console.log('Placed Order Number:', orderNum);
  console.log('✅ Checkout saga passed!\n');

  // Step 8: Order Tracking
  console.log('[STEP 8] Testing Live Order Tracking...');
  const trackRes = await sendMsg('Track order');
  console.log('Bot:\n' + trackRes.reply);
  if (!trackRes.reply.includes('Live Order Tracking') || !trackRes.reply.includes(orderNum)) {
    throw new Error('Order tracking failed!');
  }
  console.log('✅ Order tracking passed!\n');

  // Step 9: Human support handoff
  console.log('[STEP 9] Testing Human Support Handoff...');
  const helpRes = await sendMsg('help');
  console.log('Bot:\n' + helpRes.reply);
  if (!helpRes.reply.includes('store support staff')) {
    throw new Error('Human support failed!');
  }
  console.log('✅ Human support handoff passed!\n');

  console.log('=====================================================');
  console.log('🎉 ALL 10 CONVERSATIONAL COMMERCE USER JOURNEYS PASSED!');
  console.log('=====================================================');
}

run().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

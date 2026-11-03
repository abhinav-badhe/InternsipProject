const BASE_URL = 'http://localhost:3000/api/v1/whatsapp/chat';
const PHONE = '+919988112233';

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

async function main() {
  console.log('=== TEST 1: Resetting session ===');
  await sendMsg('clear');

  console.log('\n=== TEST 2: User queries generic product: "salt" ===');
  let resp = await sendMsg('salt');
  console.log('Bot Response:\n' + resp.reply);
  console.log('Interactive Buttons:', resp.options.map(o => o.title));

  console.log('\n=== TEST 3: User chooses Option 2 ("500 g Pack - ₹16") ===');
  resp = await sendMsg('2');
  console.log('Bot Response:\n' + resp.reply);

  console.log('\n=== TEST 4: User queries uncarried brand: "varna milk" ===');
  resp = await sendMsg('varna milk');
  console.log('Bot Response:\n' + resp.reply);
  console.log('Interactive Buttons:', resp.options.map(o => o.title));

  console.log('\n=== TEST 5: User chooses Option 2 ("1 Litre Tetra - ₹72") ===');
  resp = await sendMsg('2');
  console.log('Bot Response:\n' + resp.reply);

  console.log('\n=== TEST 6: User queries specific variant directly: "tata salt 1kg" ===');
  resp = await sendMsg('tata salt 1kg');
  console.log('Bot Response:\n' + resp.reply);

  console.log('\n=== TEST 7: View Cart to verify all selected variants and prices ===');
  resp = await sendMsg('view cart');
  console.log('Bot Response:\n' + resp.reply);
}

main().catch(console.error);

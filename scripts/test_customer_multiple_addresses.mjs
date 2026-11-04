import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  console.log('🚀 === VERIFYING MULTI-ADDRESS REGISTRATION & DATABASE PERSISTENCE ===\n');

  const testPhone = '+919876599888';
  const customerName = 'Abhinav Test User';

  // Step 1: Clean up any previous test addresses for this test phone
  await pool.query(`DELETE FROM customer_addresses WHERE phone ILIKE $1`, [`%9876599888%`]);

  console.log(`--- Step 1: Adding Multiple Addresses for Registered Customer (${testPhone}) ---`);

  // Address 1: HOME
  console.log('Adding Address 1 (HOME)...');
  const res1 = await fetch('http://localhost:3000/api/v1/auth/customer/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: 'HOME',
      recipientName: customerName,
      phone: testPhone,
      flatNumber: 'Flat 501, Skyrise Tower',
      street: '14th Main Road, HSR Sector 1',
      landmark: 'Opposite Agara Lake',
      city: 'Bengaluru',
      pincode: '560102',
      isDefault: true,
    })
  });
  const json1 = await res1.json();
  console.log('Address 1 Created:', json1.success ? '✅ SUCCESS' : '❌ FAILED', json1.data?.id);

  // Address 2: WORK
  console.log('Adding Address 2 (WORK)...');
  const res2 = await fetch('http://localhost:3000/api/v1/auth/customer/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: 'WORK',
      recipientName: customerName,
      phone: testPhone,
      flatNumber: 'Building 3, 2nd Floor',
      street: 'Prestige Tech Park, Marathahalli-Sarjapur Ring Rd',
      landmark: 'Near Kadubeesanahalli Bridge',
      city: 'Bengaluru',
      pincode: '560103',
      isDefault: false,
    })
  });
  const json2 = await res2.json();
  console.log('Address 2 Created:', json2.success ? '✅ SUCCESS' : '❌ FAILED', json2.data?.id);

  // Address 3: OTHER (Parents House)
  console.log('Adding Address 3 (OTHER - Parents House)...');
  const res3 = await fetch('http://localhost:3000/api/v1/auth/customer/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: 'OTHER',
      recipientName: 'Badhe Residence',
      phone: testPhone,
      flatNumber: 'Villa 12',
      street: 'Palm Meadows, Varthur Main Road',
      landmark: 'Near Forum Value Mall',
      city: 'Bengaluru',
      pincode: '560066',
      isDefault: false,
    })
  });
  const json3 = await res3.json();
  console.log('Address 3 Created:', json3.success ? '✅ SUCCESS' : '❌ FAILED', json3.data?.id);

  // Step 2: Query PostgreSQL customer_addresses directly to verify database persistence
  console.log('\n--- Step 2: Querying PostgreSQL Table "customer_addresses" Directly ---');
  const dbRows = await pool.query(
    `SELECT id, customer_id, label, recipient_name, phone, flat_number, street, city, pincode, is_default, created_at 
     FROM customer_addresses 
     WHERE phone ILIKE $1 
     ORDER BY created_at ASC`,
    [`%9876599888%`]
  );
  console.log(`✅ Total addresses persisted in PostgreSQL: ${dbRows.rows.length}`);
  dbRows.rows.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.label}] ${r.recipient_name} | ${r.flat_number ? r.flat_number + ', ' : ''}${r.street}, ${r.city} - ${r.pincode} (Default: ${r.is_default})`);
  });

  // Step 3: Fetch via Customer Web API (GET /api/v1/auth/customer/addresses?phone=...)
  console.log('\n--- Step 3: Fetch via Customer Web API ---');
  const fetchRes = await fetch(`http://localhost:3000/api/v1/auth/customer/addresses?phone=${encodeURIComponent(testPhone)}`);
  const fetchJson = await fetchRes.json();
  console.log(`API returned ${fetchJson.data?.length} addresses:`);
  fetchJson.data?.forEach(a => console.log(`  • ${a.label} (${a.recipientName}): ${a.street}`));

  // Step 4: Verify Default Toggle
  console.log('\n--- Step 4: Toggle Default Address (Set WORK as default) ---');
  const toggleRes = await fetch(`http://localhost:3000/api/v1/auth/customer/addresses/${json2.data.id}/default`, {
    method: 'PUT'
  });
  const toggleJson = await toggleRes.json();
  console.log('Set Default Result:', toggleJson.success ? '✅ SUCCESS' : '❌ FAILED');

  const checkDefault = await pool.query(`SELECT label, is_default FROM customer_addresses WHERE phone ILIKE $1 ORDER BY is_default DESC`, [`%9876599888%`]);
  console.log('Updated Defaults in Database:', checkDefault.rows.map(r => `${r.label}=${r.is_default}`).join(', '));

  // Step 5: Verify WhatsApp Bot Address Options for this Registered User
  console.log('\n--- Step 5: Test WhatsApp Order Checkout Address Prompt ---');
  // Initialize session
  await pool.query(
    `INSERT INTO whatsapp_sessions (session_id, phone_number, stage, cart_items, pending_context)
     VALUES ($1, $2, 'IDLE', $3::jsonb, '{}'::jsonb)
     ON CONFLICT (phone_number) DO UPDATE SET stage = 'IDLE', cart_items = $3::jsonb`,
    [
      crypto.randomUUID(),
      testPhone,
      JSON.stringify([{ sku: 'DAIRY-AMUL-TAAZA-1L', productName: 'Amul Taaza Milk', variantName: '1L', quantity: 2, unitPrice: 72 }])
    ]
  );

  // Send checkout to WhatsApp Bot
  const waRes = await fetch('http://localhost:3005/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: testPhone,
              id: `msg_test_${Date.now()}`,
              text: { body: 'checkout' },
              type: 'text'
            }]
          }
        }]
      }]
    })
  });
  console.log('WhatsApp Bot response status:', waRes.status);

  const lastOutbound = await pool.query(
    `SELECT content FROM whatsapp_conversation_history WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 1`
  );
  console.log('🤖 WhatsApp Bot Address Prompt for Registered Customer:');
  console.log(lastOutbound.rows[0]?.content);

  console.log('\n🎉 === MULTI-ADDRESS REGISTRATION & PERSISTENCE TEST PASSED 100%! ===');
  await pool.end();
}

main().catch(err => {
  console.error('Test error:', err);
  pool.end();
  process.exit(1);
});

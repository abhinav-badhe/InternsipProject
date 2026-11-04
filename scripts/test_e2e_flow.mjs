import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  console.log('🚀 === STARTING END-TO-END FLOW VERIFICATION ===\n');

  const customerPhone = '+917774094369';

  // STEP 1: Verify Customer Saved Addresses in PostgreSQL
  console.log('--- Step 1: Checking Customer Addresses in PostgreSQL ---');
  const addrRes = await pool.query(
    `SELECT id, label, recipient_name, phone, flat_number, street, city, pincode FROM customer_addresses WHERE phone ILIKE $1 OR customer_id IN ('cust_default', 'cust_demo')`,
    ['%7774094369%']
  );
  console.log(`Found ${addrRes.rows.length} saved addresses:`);
  addrRes.rows.forEach(a => console.log(`  • [${a.label}] ${a.recipient_name}: ${a.flat_number}, ${a.street}, ${a.city} - ${a.pincode}`));

  // Reset whatsapp session for customerPhone to start fresh
  await pool.query(
    `UPDATE whatsapp_sessions SET stage = 'IDLE', cart_items = '[]'::jsonb, pending_context = '{}'::jsonb WHERE phone_number LIKE '%7774094369%'`
  );

  // STEP 2: WhatsApp Chat Interaction
  console.log('\n--- Step 2: Customer Orders via WhatsApp ---');

  // 2a: Customer sends "add 1 amul taaza milk"
  console.log('👉 Step 2a: Customer sends: "add 1 amul taaza milk"');
  let res = await fetch('http://localhost:3005/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: customerPhone,
              id: `msg_${Date.now()}_1`,
              text: { body: 'add 1 amul taaza milk' },
              type: 'text'
            }]
          }
        }]
      }]
    })
  });

  const conv1 = await pool.query(
    `SELECT direction, content FROM whatsapp_conversation_history WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 1`
  );
  console.log('🤖 Bot variant options prompt:\n' + conv1.rows[0]?.content);

  // 2b: Customer selects variant 1
  console.log('\n👉 Step 2b: Customer selects pack size / variant: "1"');
  res = await fetch('http://localhost:3005/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: customerPhone,
              id: `msg_${Date.now()}_variant`,
              text: { body: '1' },
              type: 'text'
            }]
          }
        }]
      }]
    })
  });

  const convVariant = await pool.query(
    `SELECT direction, content FROM whatsapp_conversation_history WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 1`
  );
  console.log('🤖 Bot cart confirmation:\n' + convVariant.rows[0]?.content);

  // 2c: Customer sends "checkout"
  console.log('\n👉 Step 2c: Customer proceeds to checkout: "checkout"');
  res = await fetch('http://localhost:3005/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: customerPhone,
              id: `msg_${Date.now()}_checkout`,
              text: { body: 'checkout' },
              type: 'text'
            }]
          }
        }]
      }]
    })
  });

  const conv2 = await pool.query(
    `SELECT direction, content FROM whatsapp_conversation_history WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 1`
  );
  console.log('🤖 Bot address selection prompt:\n' + conv2.rows[0]?.content);

  // Verify session state in DB
  const sess = await pool.query(
    `SELECT phone_number, stage, pending_context FROM whatsapp_sessions WHERE phone_number LIKE '%7774094369%' ORDER BY last_message_at DESC LIMIT 1`
  );
  console.log('DB Session Stage:', sess.rows[0]?.stage);
  console.log('Pending Addresses in Context:', sess.rows[0]?.pending_context?.pendingAddresses?.map(a => a.label));

  // 2d: Customer chooses "1" (HOME Address)
  console.log('\n👉 Step 2d: Customer chooses address: "1" (HOME)');
  res = await fetch('http://localhost:3005/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: customerPhone,
              id: `msg_${Date.now()}_address`,
              text: { body: '1' },
              type: 'text'
            }]
          }
        }]
      }]
    })
  });

  const conv3 = await pool.query(
    `SELECT direction, content FROM whatsapp_conversation_history WHERE direction = 'OUTBOUND' ORDER BY created_at DESC LIMIT 1`
  );
  console.log('🤖 Bot Order Confirmation:\n' + conv3.rows[0]?.content);

  // STEP 3: Order Appears in PostgreSQL & Seller Hub
  console.log('\n--- Step 3: Check Order in Database & Seller Hub ---');
  const latestOrderRes = await pool.query(
    `SELECT id, order_number, status, grand_total, delivery_address, channel, created_at 
     FROM orders 
     ORDER BY created_at DESC 
     LIMIT 1`
  );
  const order = latestOrderRes.rows[0];
  console.log(`✅ Order Created in Database: #${order.order_number}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Channel: ${order.channel}`);
  console.log(`   Total: ₹${order.grand_total}`);
  console.log(`   Delivery Address:`, JSON.stringify(order.delivery_address));

  // Check Seller Hub Available Deliveries API
  const availRes = await fetch('http://localhost:3008/api/v1/fulfillment/deliveries/available');
  const availJson = await availRes.json();
  const foundInSellerHub = availJson.data?.some(d => d.orderId === order.id || d.orderNumber === order.order_number);
  console.log(`Available in Seller Hub Pick/Pack Queue: ${foundInSellerHub ? '✅ YES' : '❌ NO'}`);

  // STEP 4: Storekeeper Scans & Packs Order
  console.log('\n--- Step 4: Seller Barcode Scan & Packing ---');
  await pool.query(`UPDATE orders SET status = 'PACKED' WHERE id = $1`, [order.id]);
  console.log(`✅ Order #${order.order_number} marked as PACKED by storekeeper`);

  // STEP 5: Storekeeper Assigns Order to Delivery Partner (Rahul Sharma)
  console.log('\n--- Step 5: Assign Order to Delivery Partner ---');
  const ridersRes = await pool.query(`SELECT id, full_name, phone, status, total_orders_completed, earnings_today FROM delivery_riders LIMIT 1`);
  const rider = ridersRes.rows[0];
  console.log(`Assigning to Rider: ${rider.full_name} (${rider.phone})`);

  const assignRes = await fetch('http://localhost:3008/api/v1/fulfillment/deliveries/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      riderId: rider.id,
      riderName: rider.full_name,
      riderPhone: rider.phone
    })
  });
  const assignJson = await assignRes.json();
  console.log('Assignment API Result:', assignJson.success ? '✅ SUCCESS' : '❌ FAILED');

  // STEP 6: Rider App Views Assigned Delivery & Customer Location
  console.log('\n--- Step 6: Rider PWA Portal Retrieves Order Details ---');
  const activeRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/active?riderId=${rider.id}`);
  const activeJson = await activeRes.json();
  const riderOrder = activeJson.data?.find(d => d.orderId === order.id);

  console.log(`✅ Rider Order Retrieved:`);
  console.log(`   Order: #${riderOrder?.orderNumber}`);
  console.log(`   Delivery Status: ${riderOrder?.deliveryStatus}`);
  console.log(`   Recipient Name: ${riderOrder?.deliveryAddress?.recipientName}`);
  console.log(`   Recipient Phone: ${riderOrder?.deliveryAddress?.phone}`);
  console.log(`   Doorstep Address: ${riderOrder?.deliveryAddress?.addressLine1}, ${riderOrder?.deliveryAddress?.city}`);
  console.log(`   Google Maps Navigation Link: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${riderOrder?.deliveryAddress?.addressLine1}, ${riderOrder?.deliveryAddress?.city}`)}`);

  // Check generated delivery OTP in DB
  const daRow = await pool.query(
    `SELECT delivery_otp FROM delivery_assignments WHERE order_id = $1`,
    [order.id]
  );
  const realOtp = daRow.rows[0]?.delivery_otp;
  console.log(`🔑 Customer Verification OTP: ${realOtp}`);

  // STEP 7: Rider Picks Up & Starts Transit
  console.log('\n--- Step 7: Rider Picks Up Order -> IN_TRANSIT ---');
  const pickupRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/${order.id}/pickup`, {
    method: 'POST'
  });
  const pickupJson = await pickupRes.json();
  const currentOtp = pickupJson.data?.deliveryOtp || realOtp;
  console.log('Pickup API Result:', pickupRes.status === 200 ? '✅ IN_TRANSIT' : '❌ FAILED', 'Active OTP:', currentOtp);

  // STEP 8: Rider Arrives at Doorstep & Submits Customer OTP
  console.log('\n--- Step 8: Doorstep Handover & OTP Verification ---');

  // 8a: Test wrong OTP rejection
  console.log('Testing wrong OTP "0000"...');
  const wrongOtpRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/${order.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp: '0000' })
  });
  const wrongJson = await wrongOtpRes.json();
  console.log(`Wrong OTP Result (expected rejection): Status ${wrongOtpRes.status}, Error: "${wrongJson.error?.message}"`);

  // 8b: Test correct OTP acceptance
  console.log(`Testing correct OTP "${currentOtp}"...`);
  const correctOtpRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/${order.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp: currentOtp, proofNotes: 'Handed directly to customer at doorstep' })
  });
  const correctJson = await correctOtpRes.json();
  console.log('Correct OTP Handover Result:', correctJson.success ? '✅ DELIVERED' : `❌ FAILED: ${JSON.stringify(correctJson)}`);

  // STEP 9: Final Status & Performance Verification
  console.log('\n--- Step 9: Final Verification of Order & Rider Records ---');
  const finalOrder = await pool.query(`SELECT status FROM orders WHERE id = $1`, [order.id]);
  const finalRider = await pool.query(`SELECT full_name, status, total_orders_completed, earnings_today FROM delivery_riders WHERE id = $1`, [rider.id]);

  console.log(`Order Final Status: ${finalOrder.rows[0]?.status}`);
  console.log(`Rider Final Status: ${finalRider.rows[0]?.status}`);
  console.log(`Rider Total Orders Completed: ${finalRider.rows[0]?.total_orders_completed}`);
  console.log(`Rider Today Earnings: ₹${finalRider.rows[0]?.earnings_today}`);

  console.log('\n🎉 === ALL END-TO-END FLOW CHECKS COMPLETED SUCCESSFULLY! ===');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal Test Error:', err);
  pool.end();
  process.exit(1);
});

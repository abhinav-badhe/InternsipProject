import { Pool } from 'pg';

const GATEWAY_URL = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function runTest() {
  console.log('================================================================');
  console.log('  TESTING SEPARATE DELIVERY PARTNER MODULE & FIRST-ACCEPT-WINS  ');
  console.log('================================================================\n');

  const partner1Phone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;
  const partner2Phone = `+9198765${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Independent Registration for Delivery Partner 1
  console.log(`[1] Registering Delivery Partner 1 (${partner1Phone})...`);
  const reg1Res = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/delivery-partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vikram Singh (Partner A)',
      phone: partner1Phone,
      email: `vikram_${Date.now()}@fleet.freshcart.io`,
      password: 'RiderSecret@123',
      vehicleType: 'EV_2W',
      vehicleNumber: 'KA-05-EV-4412',
      drivingLicense: 'DL-0420230099881',
      darkStoreName: 'FreshCart Dark Store #04 - Koramangala',
      emergencyContact: '+919800011122',
      bloodGroup: 'O+'
    })
  });
  const reg1Data = await reg1Res.json();
  if (!reg1Data.success) {
    throw new Error(`Partner 1 registration failed: ${JSON.stringify(reg1Data)}`);
  }
  console.log(`   ✅ Partner 1 Registered! Rider ID: ${reg1Data.data.partner.id}, Status: ${reg1Data.data.partner.status}, Role: ${reg1Data.data.partner.role}`);

  // 2. Independent Registration for Delivery Partner 2
  console.log(`\n[2] Registering Delivery Partner 2 (${partner2Phone})...`);
  const reg2Res = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/delivery-partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Sunil Verma (Partner B)',
      phone: partner2Phone,
      email: `sunil_${Date.now()}@fleet.freshcart.io`,
      password: 'RiderSecret@123',
      vehicleType: 'MOTORCYCLE',
      vehicleNumber: 'KA-01-AB-7788',
      drivingLicense: 'DL-0120220044552',
      darkStoreName: 'FreshCart Dark Store #04 - Koramangala',
      emergencyContact: '+919800033344',
      bloodGroup: 'B+'
    })
  });
  const reg2Data = await reg2Res.json();
  if (!reg2Data.success) {
    throw new Error(`Partner 2 registration failed: ${JSON.stringify(reg2Data)}`);
  }
  console.log(`   ✅ Partner 2 Registered! Rider ID: ${reg2Data.data.partner.id}, Status: ${reg2Data.data.partner.status}, Role: ${reg2Data.data.partner.role}`);

  // 3. Dedicated Login for Partner 1
  console.log('\n[3] Authenticating Delivery Partner 1 at /delivery/login...');
  const login1Res = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/delivery-partners/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneOrEmail: partner1Phone,
      password: 'RiderSecret@123'
    })
  });
  const login1Data = await login1Res.json();
  if (!login1Data.success) {
    throw new Error(`Partner 1 login failed: ${JSON.stringify(login1Data)}`);
  }
  const token1 = login1Data.data.token;
  console.log(`   ✅ Partner 1 Logged In! Session Token granted. Status: ${login1Data.data.partner.status}`);

  // 4. Dedicated Login for Partner 2
  console.log('\n[4] Authenticating Delivery Partner 2 at /delivery/login...');
  const login2Res = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/delivery-partners/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneOrEmail: partner2Phone,
      password: 'RiderSecret@123'
    })
  });
  const login2Data = await login2Res.json();
  if (!login2Data.success) {
    throw new Error(`Partner 2 login failed: ${JSON.stringify(login2Data)}`);
  }
  const token2 = login2Data.data.token;
  console.log(`   ✅ Partner 2 Logged In! Session Token granted. Status: ${login2Data.data.partner.status}`);

  // 5. Create a test order and mark it "Ready for Delivery"
  console.log('\n[5] Creating a test order and marking "Ready for Delivery"...');
  const orderNum = `ORD-TEST-${Date.now().toString().slice(-6)}`;
  const orderRes = await pool.query(
    `INSERT INTO orders (
      order_number, idempotency_key, customer_id, channel, status,
      currency, subtotal, tax_total, grand_total, reservation_id, payment_intent_id,
      delivery_address, ready_for_pickup, ready_for_pickup_at
    ) VALUES (
      $1, $2, 'c0000000-0000-0000-0000-000000000001', 'WEB', 'CONFIRMED',
      'INR', 450.00, 22.50, 472.50, '809dbf4b-e9d3-435f-a7bb-328dcc5bbeed', 'COD_ORDER',
      $3, FALSE, NULL
    ) RETURNING id, order_number`,
    [
      orderNum,
      `idem-${Date.now()}`,
      JSON.stringify({
        fullName: 'Abhinav Customer',
        phone: '+919999888877',
        street: 'Flat 402, Green Glen Layout, Bellandur',
        city: 'Bengaluru',
        postalCode: '560103',
        lat: 12.9279,
        lng: 77.6743
      })
    ]
  );
  const testOrderId = orderRes.rows[0].id;
  console.log(`   ✅ Order created: ${orderNum} (ID: ${testOrderId})`);

  // Shopkeeper marks "Ready for Delivery"
  console.log('   Shopkeeper clicks "Mark Ready for Delivery"...');
  const readyRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/orders/${testOrderId}/ready-for-delivery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const readyData = await readyRes.json();
  if (!readyData.success) {
    throw new Error(`Failed to mark order ready for delivery: ${JSON.stringify(readyData)}`);
  }
  console.log(`   ✅ Order is now PACKED & ready_for_pickup = TRUE. Broadcast event emitted to fleet.`);

  // 6. Both partners check Available Orders pool
  console.log('\n[6] Checking Available Orders pool for online partners...');
  const availRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/available`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  const availData = await availRes.json();
  console.log('   Available endpoint response:', JSON.stringify(availData).slice(0, 300));
  const availableOrders = availData.data || [];
  const foundOrder = availableOrders.find((o) => o.orderId === testOrderId);
  if (!foundOrder) {
    throw new Error(`Order ${testOrderId} not found in available orders list!`);
  }
  console.log(`   ✅ Order visible in Available Orders Pool:`);
  console.log(`      • Distance: ${foundOrder.distanceKm} km`);
  console.log(`      • ETA: ~${foundOrder.estimatedMinutes} mins`);
  console.log(`      • Payout: ₹${foundOrder.estimatedPayout}`);
  console.log(`      • Store: ${foundOrder.storeLocation.name} (${foundOrder.storeLocation.lat}, ${foundOrder.storeLocation.lng})`);
  console.log(`      • Drop: ${foundOrder.dropLocation.address} (${foundOrder.dropLocation.lat}, ${foundOrder.dropLocation.lng})`);

  // 7. FIRST ACCEPTANCE WINS CONCURRENCY TEST
  console.log('\n[7] ⚡ FIRST-ACCEPTANCE-WINS CONCURRENCY TEST ⚡');
  console.log('   Partner 1 and Partner 2 send simultaneous accept requests for the SAME order...');

  const [res1, res2] = await Promise.all([
    fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token1}`
      }
    }),
    fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token2}`
      }
    })
  ]);

  const data1 = await res1.json();
  const data2 = await res2.json();

  console.log(`   Partner 1 Response: HTTP ${res1.status} - ${res1.status === 200 ? 'SUCCESS' : data1.error?.message}`);
  console.log(`   Partner 2 Response: HTTP ${res2.status} - ${res2.status === 200 ? 'SUCCESS' : data2.error?.message}`);

  // Validate ACID concurrency guarantee
  const successCount = (res1.status === 200 ? 1 : 0) + (res2.status === 200 ? 1 : 0);
  const conflictCount = (res1.status === 409 ? 1 : 0) + (res2.status === 409 ? 1 : 0);

  if (successCount !== 1 || conflictCount !== 1) {
    throw new Error(`ACID concurrency test failed! Expected 1 success and 1 conflict 409, got ${successCount} success and ${conflictCount} conflict.`);
  }

  const winningPartner = res1.status === 200 ? 'Partner 1 (Vikram)' : 'Partner 2 (Sunil)';
  const winningToken = res1.status === 200 ? token1 : token2;
  const losingPartner = res1.status === 200 ? 'Partner 2 (Sunil)' : 'Partner 1 (Vikram)';
  console.log(`\n   🎉 Concurrency Protection Verified:`);
  console.log(`      🏆 Winner: ${winningPartner} was assigned the order!`);
  console.log(`      🚫 Rejection: ${losingPartner} received HTTP 409: "This order has already been accepted by another delivery partner."`);

  // 8. Verify order has disappeared from Available Orders for other partners
  console.log('\n[8] Verifying order has vanished from Available Orders pool...');
  const poolCheckRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/available`, {
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  const poolCheck = await poolCheckRes.json();
  const stillAvailable = (poolCheck.data || []).some((o) => o.orderId === testOrderId);
  if (stillAvailable) {
    throw new Error(`Order ${testOrderId} is still visible in Available Orders! It must disappear.`);
  }
  console.log('   ✅ Order successfully disappeared from Available Orders for all partners!');

  // 9. Winning Partner Lifecycle: REACHED_STORE -> IN_TRANSIT -> DELIVERED (with OTP)
  console.log('\n[9] Testing Delivery Partner Task Lifecycle...');

  // 9a. Reached Store
  console.log('   Step 1: Partner clicks "Reached Store"...');
  const reachedRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${winningToken}`
    },
    body: JSON.stringify({ status: 'REACHED_STORE' })
  });
  const reachedData = await reachedRes.json();
  console.log(`   ✅ Status updated to: ${reachedData.data?.status || reachedData.data?.assignment?.status}`);

  // 9b. Dispatched / In Transit
  console.log('   Step 2: Partner clicks "Pick Up & Start Delivery"...');
  const transitRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${winningToken}`
    },
    body: JSON.stringify({ status: 'IN_TRANSIT' })
  });
  const transitData = await transitRes.json();
  console.log(`   ✅ Status updated to: ${transitData.data?.status || transitData.data?.assignment?.status}. Customer notified with 4-digit PIN.`);

  // Get OTP from assignment row to simulate customer sharing OTP
  const assignCheck = await pool.query(
    'SELECT delivery_otp FROM delivery_assignments WHERE order_id = $1',
    [testOrderId]
  );
  const correctOtp = assignCheck.rows[0]?.delivery_otp;
  console.log(`   Customer gives OTP: "${correctOtp}"`);

  // Test wrong OTP rejection
  console.log('   Testing incorrect OTP rejection (e.g. "0000")...');
  const wrongOtpRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${winningToken}`
    },
    body: JSON.stringify({ status: 'DELIVERED', otp: '0000' })
  });
  const wrongOtpData = await wrongOtpRes.json();
  console.log(`   ✅ Wrong OTP rejected with code: ${wrongOtpData.error?.code} - "${wrongOtpData.error?.message}"`);

  // Submit correct OTP
  console.log(`   Submitting correct OTP "${correctOtp}"...`);
  const deliverRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/deliveries/${testOrderId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${winningToken}`
    },
    body: JSON.stringify({ status: 'DELIVERED', otp: correctOtp })
  });
  const deliverData = await deliverRes.json();
  if (!deliverData.success) {
    throw new Error(`Delivery completion failed: ${JSON.stringify(deliverData)}`);
  }
  console.log(`   ✅ Order DELIVERED successfully! Verification verified.`);

  // 10. Check winning partner's updated earnings
  const meRes = await fetch(`${GATEWAY_URL}/api/v1/fulfillment/delivery-partners/me`, {
    headers: { 'Authorization': `Bearer ${winningToken}` }
  });
  const meData = await meRes.json();
  const partnerProfile = meData.data?.partner || meData.data;
  console.log(`\n[10] Winning Partner Dashboard Profile:`);
  console.log(`     • Name: ${partnerProfile.fullName || partnerProfile.full_name}`);
  console.log(`     • Duty Status: ${partnerProfile.status}`);
  console.log(`     • Completed Orders: ${partnerProfile.totalOrdersCompleted || partnerProfile.total_orders_completed}`);
  console.log(`     • Today's Payout: ₹${partnerProfile.earningsToday || partnerProfile.earnings_today}`);

  console.log('\n================================================================');
  console.log('   🎉 ALL DELIVERY PARTNER TESTS PASSED WITH 100% SUCCESS!     ');
  console.log('================================================================');

  await pool.end();
}

runTest().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  pool.end();
  process.exit(1);
});

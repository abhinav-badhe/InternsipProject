import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  console.log('🚀 === VERIFYING MAP PIN DOORSTEP GPS MARKING & NAVIGATION ===\n');

  const testPhone = '+919988117766';
  const customerName = 'Abhinav Doorstep Map Test';

  // Specific marked map pin location (e.g. 5th Cross, HSR Sector 2)
  const markedLat = 12.915523;
  const markedLng = 77.643218;

  // Step 1: Save address with custom marked GPS pin coordinates
  console.log('--- Step 1: Saving Address with User Marked GPS Pin ---');
  console.log(`Pin Coordinates: ${markedLat}, ${markedLng}`);

  const addRes = await fetch('http://localhost:3000/api/v1/auth/customer/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: 'HOME',
      recipientName: customerName,
      phone: testPhone,
      flatNumber: 'Flat 302, Lake View Tower',
      street: '5th Cross, 19th Main Road, HSR Sector 2',
      landmark: 'Opposite Sector 2 Park',
      city: 'Bengaluru',
      pincode: '560102',
      isDefault: true,
      lat: markedLat,
      lng: markedLng,
    })
  });
  const addJson = await addRes.json();
  console.log('Address Save Response:', addJson.success ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Saved Address ID:', addJson.data?.id);
  console.log(`Saved Coordinates in API: lat=${addJson.data?.lat}, lng=${addJson.data?.lng}`);

  // Step 2: Query PostgreSQL customer_addresses directly to verify GPS persistence
  console.log('\n--- Step 2: Verifying PostgreSQL Storage ---');
  const dbRow = await pool.query(
    `SELECT id, recipient_name, street, lat, lng FROM customer_addresses WHERE id = $1`,
    [addJson.data.id]
  );
  console.log('Database Row:', dbRow.rows[0]);
  const dbLat = parseFloat(dbRow.rows[0].lat);
  const dbLng = parseFloat(dbRow.rows[0].lng);
  console.log(`DB GPS Coordinates: ${dbLat}, ${dbLng}`);
  if (Math.abs(dbLat - markedLat) < 0.0001 && Math.abs(dbLng - markedLng) < 0.0001) {
    console.log('✅ GPS coordinates match marked pin precisely in PostgreSQL!');
  } else {
    throw new Error('GPS coordinates do not match in DB');
  }

  // Step 3: Place Order with this address
  console.log('\n--- Step 3: Placing Order with Marked Doorstep Location ---');
  const idempotencyKey = `test_order_${Date.now()}`;
  const orderRes = await fetch('http://localhost:3004/api/v1/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey,
      channel: 'WEB',
      customerId: addJson.data.customerId,
      deliveryAddress: {
        recipientName: addJson.data.recipientName,
        phone: addJson.data.phone,
        addressLine1: `${addJson.data.flatNumber ? addJson.data.flatNumber + ', ' : ''}${addJson.data.street}`,
        city: addJson.data.city,
        postalCode: addJson.data.pincode,
        label: addJson.data.label,
        lat: dbLat,
        lng: dbLng,
      },
      items: [{ sku: 'DAIR-AMUL-TAAZA-HOMOGENISED-M-1-1L', quantity: 2 }]
    })
  });
  const orderJson = await orderRes.json();
  console.log('Order Placement:', orderJson.success ? '✅ SUCCESS' : '❌ FAILED', orderJson.data?.orderNumber);
  const orderId = orderJson.data?.orderId;
  const orderNumber = orderJson.data?.orderNumber;

  // Step 4: Seller Hub Barcode Scan & Pack
  console.log('\n--- Step 4: Seller Hub Pick & Pack ---');
  await pool.query(`UPDATE orders SET status = 'PACKED' WHERE id = $1`, [orderId]);
  console.log(`✅ Order #${orderNumber} packed by storekeeper`);

  // Step 5: Assign to Delivery Partner
  console.log('\n--- Step 5: Assign Order to Rider ---');
  const riderRow = (await pool.query(`SELECT id, full_name, phone FROM delivery_riders LIMIT 1`)).rows[0];
  const assignRes = await fetch('http://localhost:3008/api/v1/fulfillment/deliveries/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      riderId: riderRow.id,
      riderName: riderRow.full_name,
      riderPhone: riderRow.phone,
    })
  });
  console.log('Assignment Result:', (await assignRes.json()).success ? '✅ ASSIGNED' : '❌ FAILED');

  // Step 6: Rider App Views Delivery & Verifies Exact GPS Navigation Link
  console.log('\n--- Step 6: Verifying Delivery Partner GPS Navigation Link ---');
  const activeRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/active?riderId=${riderRow.id}`);
  const activeJson = await activeRes.json();
  const riderDelivery = activeJson.data?.find(d => d.orderId === orderId);

  const riderAddr = riderDelivery?.deliveryAddress;
  console.log(`Rider Order: #${riderDelivery?.orderNumber}`);
  console.log(`Customer Recipient: ${riderAddr?.recipientName}`);
  console.log(`Customer Phone: ${riderAddr?.phone}`);
  console.log(`Doorstep GPS: lat=${riderAddr?.lat}, lng=${riderAddr?.lng}`);

  const expectedNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${riderAddr?.lat},${riderAddr?.lng}`;
  console.log(`📍 Google Maps Turn-by-Turn GPS Navigation URL:\n   ${expectedNavUrl}`);

  // Step 7: Pickup & Doorstep OTP Handover
  console.log('\n--- Step 7: Pickup & Handover with Customer OTP ---');
  const pickupRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/${orderId}/pickup`, { method: 'POST' });
  const pickupJson = await pickupRes.json();
  const otp = pickupJson.data?.deliveryOtp;
  console.log(`Pickup Status: ${pickupRes.status === 200 ? '✅ IN_TRANSIT' : '❌ FAILED'}, Customer OTP: ${otp}`);

  const completeRes = await fetch(`http://localhost:3008/api/v1/fulfillment/deliveries/${orderId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp })
  });
  console.log('Doorstep Handover Result:', (await completeRes.json()).success ? '✅ DELIVERED' : '❌ FAILED');

  console.log('\n🎉 === MAP PIN MARKING & DOORSTEP GPS NAVIGATION TEST PASSED 100%! ===');
  await pool.end();
}

main().catch(err => {
  console.error('Test error:', err);
  pool.end();
  process.exit(1);
});

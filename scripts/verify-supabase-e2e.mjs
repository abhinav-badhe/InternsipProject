async function runE2eChecks() {
  console.log('====================================================');
  console.log('RUNNING FULL END-TO-END SUPABASE VERIFICATION CHECKS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function check(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Gateway Live Check
  await check('API Gateway Healthcheck', async () => {
    const res = await fetch('http://localhost:3000/health/live');
    const json = await res.json();
    if (json.status !== 'live') throw new Error('Gateway not live');
  });

  // 2. Categories from Supabase
  await check('Catalog Categories from Supabase', async () => {
    const res = await fetch('http://localhost:3000/api/v1/catalog/categories');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error('Categories fetch failed');
    }
    console.log(`       Found ${json.data.length} categories in Supabase.`);
  });

  // 3. Products from Supabase
  await check('Catalog Products from Supabase', async () => {
    const res = await fetch('http://localhost:3000/api/v1/catalog/products');
    const json = await res.json();
    const list = json.data?.items || json.data?.products || [];
    if (!json.success || list.length === 0) {
      throw new Error('Products fetch failed');
    }
    console.log(`       Found ${list.length} products in Supabase.`);
  });

  // 4. Category Disambiguation from Supabase
  await check('Catalog Disambiguation (Search: "soap")', async () => {
    const res = await fetch('http://localhost:3000/api/v1/catalog/disambiguate?term=soap');
    const json = await res.json();
    if (!json.success || !json.data?.isAmbiguous) {
      throw new Error('Disambiguation failed or not ambiguous');
    }
    console.log(`       Matched ${json.data.matchingCategories?.length} distinct subcategories.`);
  });

  // 5. Customer Registration in Supabase
  let customerToken = '';
  let customerId = '';
  const customerEmail = `cust_${Date.now()}@test.supabase`;
  await check('Customer Registration in Supabase identity_db', async () => {
    const res = await fetch('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Supabase Test Customer',
        email: customerEmail,
        password: 'Password123!',
        role: 'CUSTOMER',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.token) {
      throw new Error(json.error?.message || 'Registration failed');
    }
    customerToken = json.data.token;
    customerId = json.data.user.userId;
    console.log(`       Registered user: ${customerId} (${customerEmail})`);
  });

  // 6. Pricing Quote Calculation
  let quoteTotal = 0;
  await check('Pricing Service Calculation (Taxes & GST)', async () => {
    const res = await fetch('http://localhost:3000/api/v1/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.grandTotal) {
      throw new Error(json.error?.message || 'Quote failed');
    }
    quoteTotal = json.data.grandTotal;
    console.log(`       Subtotal: ₹${json.data.subtotal}, Tax: ₹${json.data.taxTotal}, GrandTotal: ₹${quoteTotal}`);
  });

  // 7. Real Checkout Saga & Stock Reservation in Supabase
  let createdOrderId = '';
  let createdOrderNumber = '';
  await check('Distributed Checkout Saga & Row-Level Stock Reservation', async () => {
    const res = await fetch('http://localhost:3000/api/v1/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        idempotencyKey: `idemp_${Date.now()}`,
        customerId,
        channel: 'WEB',
        deliveryAddress: { street: 'Supabase Cloud Way', city: 'Stockholm', pincode: '10001' },
        items: [{ sku: 'DOVE-BAR-75G', quantity: 2 }],
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.orderNumber) {
      throw new Error(json.error?.message || 'Checkout saga failed');
    }
    createdOrderId = json.data.orderId;
    createdOrderNumber = json.data.orderNumber;
    console.log(`       Order Placed: ${createdOrderNumber} (Reservation ID: ${json.data.reservationId})`);
  });

  // 8. Order Query from Supabase
  await check('Query Customer Order from Supabase', async () => {
    const res = await fetch('http://localhost:3000/api/v1/orders', {
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error('Order list query failed');
    }
    const found = json.data.find((o) => o.order_number === createdOrderNumber || o.id === createdOrderId);
    if (!found) throw new Error(`Created order ${createdOrderNumber} not found in Supabase`);
    console.log(`       Verified order in Supabase with grand_total: ₹${found.grand_total}`);
  });

  // 9. Store Admin Auth & Inventory Adjustment in Supabase
  let adminToken = '';
  await check('Store Admin Authentication in Supabase', async () => {
    // Try login or register
    const adminEmail = 'admin@grocery.local';
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail, password: 'adminpassword123' }),
    });
    const loginJson = await loginRes.json();
    if (loginJson.success && loginJson.data?.token) {
      adminToken = loginJson.data.token;
    } else {
      const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Supabase Admin',
          email: adminEmail,
          password: 'adminpassword123',
          role: 'STORE_ADMIN',
        }),
      });
      const regJson = await regRes.json();
      adminToken = regJson.data.token;
    }
    console.log('       Admin JWT token obtained successfully.');
  });

  // 10. Real Inventory Adjustment in Supabase
  await check('Inventory Stock Adjustment & Audit Ledger in Supabase', async () => {
    const res = await fetch('http://localhost:3000/api/v1/inventory/adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sku: 'DOVE-BAR-75G',
        delta: 15,
        reason: 'SUPABASE_E2E_VERIFICATION_RESTOCK',
        locationZone: 'Central Zone',
      }),
    });
    const json = await res.json();
    if (!json.success || json.data?.onHandQuantity === undefined) {
      throw new Error(json.error?.message || 'Inventory adjustment failed');
    }
    console.log(`       Updated SKU DOVE-BAR-75G onHand: ${json.data.onHandQuantity}, reserved: ${json.data.reservedQuantity}`);
  });

  console.log('\n====================================================');
  console.log(`FINAL RESULT: ${passed}/${total} CHECKS PASSED ON SUPABASE`);
  console.log('====================================================');
}

runE2eChecks().catch(console.error);

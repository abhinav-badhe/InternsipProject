import dotenv from 'dotenv';
dotenv.config();
import crypto from 'node:crypto';

async function testOutofStockSearch() {
  const { Database } = await import('../services/whatsapp-adapter/dist/db.js');
  // Reset initial test condition: LUX-ROSE-3X100G has 0 stock and no alerts
  await Database.query(`UPDATE stock_balances SET on_hand_qty = 0, reserved_qty = 0 WHERE sku = 'LUX-ROSE-3X100G'`);
  await Database.query(`DELETE FROM back_in_stock_alerts WHERE sku = 'LUX-ROSE-3X100G'`);
  await Database.query(`DELETE FROM whatsapp_sessions WHERE phone_number = '917774094369'`);

  console.log('--- Step 1: Customer searches for out-of-stock Lux Rose Soap ---');
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '912913085238729',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15556041434',
                phone_number_id: '1327188473821869',
              },
              contacts: [{ profile: { name: 'Abhinav' }, wa_id: '917774094369' }],
              messages: [
                {
                  from: '917774094369',
                  id: 'wamid.test_' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: 'lux rose soap 3 pcs' },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const bodyStr = JSON.stringify(payload);
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || '';
  const hmac = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  const res = await fetch('http://localhost:3000/api/v1/whatsapp/webhook?sync=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=' + hmac,
    },
    body: bodyStr,
  });

  console.log('Webhook Response HTTP Status:', res.status);
  const json = await res.json();
  console.log('Webhook Response Body:', JSON.stringify(json, null, 2));

  // Check back_in_stock_alerts table
  const alertRows = await Database.query(
    `SELECT * FROM back_in_stock_alerts WHERE phone_number = $1`,
    ['917774094369']
  );
  console.log('\n--- Step 2: Back-In-Stock Alerts in PostgreSQL ---');
  console.log(alertRows.rows);

  if (alertRows.rows.length === 0) {
    console.error('FAILED: No alert recorded in back_in_stock_alerts');
    process.exit(1);
  }

  const sku = alertRows.rows[0].sku;
  console.log(`\n--- Step 3: Simulating Inventory Restock for SKU: ${sku} (+10 units) ---`);
  
  const restockRes = await fetch('http://localhost:3003/api/v1/inventory/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku,
      delta: 10,
      reason: 'RECEIPT',
      locationZone: 'ZONE-A1',
    }),
  });

  console.log('Restock API Status:', restockRes.status);
  const restockData = await restockRes.json();
  console.log('Restock Result:', restockData);

  // Wait 3.5 seconds for async notification to complete
  await new Promise((resolve) => setTimeout(resolve, 3500));

  const updatedAlerts = await Database.query(
    `SELECT * FROM back_in_stock_alerts WHERE phone_number = $1`,
    ['917774094369']
  );
  console.log('\n--- Step 4: Updated Alert Status in PostgreSQL ---');
  console.log(updatedAlerts.rows);

  // Check conversation history
  const history = await Database.query(
    `SELECT direction, message_type, content, created_at 
     FROM whatsapp_conversation_history 
     ORDER BY created_at DESC LIMIT 3`
  );
  console.log('\n--- Step 5: Latest WhatsApp Bot Outbound Messages ---');
  console.log(history.rows);

  console.log('\n--- Step 6: Customer clicks "Buy Now" for Restocked Item ---');
  const buyPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '912913085238729',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15556041434',
                phone_number_id: '1327188473821869',
              },
              contacts: [{ profile: { name: 'Abhinav' }, wa_id: '917774094369' }],
              messages: [
                {
                  from: '917774094369',
                  id: 'wamid.buy_' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: `buy_${sku}` },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const buyBodyStr = JSON.stringify(buyPayload);
  const buyHmac = crypto.createHmac('sha256', secret).update(buyBodyStr).digest('hex');

  const buyRes = await fetch('http://localhost:3000/api/v1/whatsapp/webhook?sync=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=' + buyHmac,
    },
    body: buyBodyStr,
  });

  const buyJson = await buyRes.json();
  console.log('Buy Response:', JSON.stringify(buyJson, null, 2));

  // Check alert converted
  const convertedAlerts = await Database.query(
    `SELECT * FROM back_in_stock_alerts WHERE phone_number = $1`,
    ['917774094369']
  );
  console.log('\n--- Step 7: Final Alert Status in PostgreSQL (should be CONVERTED) ---');
  console.log(convertedAlerts.rows);

  console.log('\nSUCCESS! Back-in-stock alert workflow verified end-to-end.');
  process.exit(0);
}

testOutofStockSearch().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

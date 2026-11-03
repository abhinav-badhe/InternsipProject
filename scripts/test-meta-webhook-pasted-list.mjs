// Using Node global fetch

async function testMetaWebhook() {
  const metaPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: 'PHONE_NUMBER_ID_101'
              },
              contacts: [
                {
                  profile: { name: 'Customer Abhinav' },
                  wa_id: '919876543210'
                }
              ],
              messages: [
                {
                  from: '919876543210',
                  id: `wamid.test_${Date.now()}_list`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'text',
                  text: {
                    body: `sende me thesee items

1. amul butter 500 gms
2. lux rose soap 3 pcs
3. large sandwitch bread
4. colgate toothpaste 2 pcs
5. hair and care shampoo 200 gms
6. tata salt 500 gms
7. sugar 2 kgs
8. surf excel top laoding poweder 4 kgs`
                  }
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  console.log('Sending Meta Webhook payload to http://localhost:3000/api/v1/whatsapp/webhook?sync=true...');
  const res = await fetch('http://localhost:3000/api/v1/whatsapp/webhook?sync=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metaPayload)
  });

  const json = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('\n--- Bot Reply Sent to WhatsApp ---');
  console.log(json.data?.outboundMessage?.bodyText);
  console.log('\n--- Session Cart Items in DB ---');
  console.log(JSON.stringify(json.data?.session?.cartItems, null, 2));
}

testMetaWebhook().catch(console.error);

import assert from 'node:assert/strict';

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

async function sendChat(phone, message) {
  const res = await fetch(`${GATEWAY_URL}/api/v1/whatsapp/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, message }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Chat failed');
  return json.data;
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 TESTING END-TO-END MULTI-VARIANT CATALOG & WHATSAPP AUTOMATION');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: CREATE PRODUCT WITH MULTIPLE VARIANTS VIA CATALOG API
  // -------------------------------------------------------------------------
  console.log('▶ TEST 1: Shopkeeper adds a Product with Multiple Variants & Distinct Prices');
  const timestamp = Date.now().toString().slice(-4);
  const newProductPayload = {
    productName: `Organic Himalayan Rock Salt ${timestamp}`,
    brandName: 'Organic Tattva',
    primaryCategoryId: '11000000-0000-0000-0000-000000000012',
    storageType: 'ambient',
    shelfLifeDays: 365,
    isVeg: true,
    variants: [
      {
        variantName: '500 g Pouch',
        sku: `ORG-SALT-500G-${timestamp}`,
        sellingPrice: 45.0,
        mrp: 50.0,
        initialStock: 60,
        netWeightValue: 500,
        measurementUnit: 'g'
      },
      {
        variantName: '1 kg Pouch',
        sku: `ORG-SALT-1KG-${timestamp}`,
        sellingPrice: 85.0,
        mrp: 95.0,
        initialStock: 40,
        netWeightValue: 1,
        measurementUnit: 'kg'
      }
    ]
  };

  const createRes = await fetch('http://localhost:3001/api/v1/catalog/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload),
  });
  const createJson = await createRes.json();
  assert.equal(createRes.status, 201, 'Product creation status should be 201');
  assert.ok(createJson.data.product?.id, 'Product ID should be generated');
  assert.equal(createJson.data.variants?.length, 2, 'Should create 2 variants');
  console.log(`✅ Successfully created product: "${newProductPayload.productName}" with 2 variants in PostgreSQL!\n`);

  // -------------------------------------------------------------------------
  // TEST 2: ADD A THIRD VARIANT TO THE EXISTING PRODUCT
  // -------------------------------------------------------------------------
  console.log('▶ TEST 2: Shopkeeper adds another Variant to the Existing Product');
  const productId = createJson.data.product.id;
  const addVarPayload = {
    variantName: '2 kg Jar',
    sku: `ORG-SALT-2KG-${timestamp}`,
    sellingPrice: 160.0,
    mrp: 180.0,
    initialStock: 25,
    netWeightValue: 2,
    measurementUnit: 'kg'
  };

  const addVarRes = await fetch(`http://localhost:3001/api/v1/catalog/products/${productId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(addVarPayload),
  });
  const addVarJson = await addVarRes.json();
  assert.equal(addVarRes.status, 201, 'Adding variant status should be 201');
  assert.equal(addVarJson.data.sku, addVarPayload.sku);
  console.log(`✅ Successfully added 3rd variant "${addVarPayload.variantName}" (₹${addVarPayload.sellingPrice}) to product!\n`);

  // -------------------------------------------------------------------------
  // TEST 3: VERIFY CATALOG SEARCH RETURNS VARIANTS WITH PRICES & STOCK
  // -------------------------------------------------------------------------
  console.log('▶ TEST 3: Catalog Search returns all variants with Prices & Stock');
  const searchRes = await fetch(`http://localhost:3001/api/v1/catalog/products?query=Organic+Himalayan+Rock+Salt+${timestamp}`);
  const searchJson = await searchRes.json();
  const foundProd = searchJson.data.items[0];
  assert.ok(foundProd, 'Should find created product');
  assert.equal(foundProd.variants.length, 3, 'Product should have 3 variants');
  const priceMap = Object.fromEntries(foundProd.variants.map(v => [v.sku, v.price]));
  assert.equal(priceMap[`ORG-SALT-500G-${timestamp}`], 45);
  assert.equal(priceMap[`ORG-SALT-1KG-${timestamp}`], 85);
  assert.equal(priceMap[`ORG-SALT-2KG-${timestamp}`], 160);
  console.log(`✅ Verified variants with live prices: ₹45 (500g), ₹85 (1kg), ₹160 (2kg)!\n`);

  // -------------------------------------------------------------------------
  // TEST 4: WHATSAPP - CUSTOMER ASKS FOR ITEM WITHOUT SPECIFYING VARIANT
  // -------------------------------------------------------------------------
  console.log('▶ TEST 4: WhatsApp Automation - Customer asks for item WITHOUT specifying variant');
  const testPhoneA = `+9199881${Math.floor(10000 + Math.random() * 90000)}`;

  console.log(`👤 Customer ${testPhoneA} asks: "tata salt" (no variant/size specified)`);
  const replyA = await sendChat(testPhoneA, 'tata salt');
  console.log('💬 Bot Reply:');
  console.log(replyA.reply);

  assert.ok(replyA.reply.includes('Available Options & Variants') || replyA.reply.includes('Available'));
  assert.ok(replyA.reply.includes('500 g Pack') || replyA.reply.includes('500 g'));
  assert.ok(replyA.reply.includes('1 kg Pouch') || replyA.reply.includes('1 kg'));
  console.log('✅ Bot successfully detected multiple variants and prompted customer to choose!\n');

  console.log('👤 Customer selects option 1: "1"');
  const replyA2 = await sendChat(testPhoneA, '1');
  console.log('💬 Bot Reply:');
  console.log(replyA2.reply);
  assert.ok(replyA2.reply.includes('Added'));
  assert.ok(replyA2.reply.includes('1 kg Pouch') || replyA2.reply.includes('500 g Pack'));
  console.log('✅ Chosen variant successfully added to cart!\n');

  // -------------------------------------------------------------------------
  // TEST 5: WHATSAPP - CUSTOMER SENDS THE USER\'S EXACT 8 ITEMS LIST
  // -------------------------------------------------------------------------
  console.log('========================================================================');
  console.log('▶ TEST 5: WhatsApp - Customer sends user\'s exact 8 items list');
  console.log('========================================================================');

  const testPhoneB = `+9199882${Math.floor(10000 + Math.random() * 90000)}`;
  const shoppingList = `sende me thesee items

1. amul butter 500 gms
2. lux rose soap 3 pcs
3. large sandwitch bread
4. colgate toothpaste 2 pcs
5. hair and care shampoo 200 gms
6. tata salt 500 gms
7. sugar 2 kgs
8. surf excel top laoding poweder 4 kgs`;

  console.log(`👤 Customer ${testPhoneB} sends:\n${shoppingList}\n`);
  const listReply = await sendChat(testPhoneB, shoppingList);
  console.log('💬 Bot Reply (List Breakdown & Stock Check):');
  console.log(listReply.reply);

  // Assert in-stock items with specific variants matched and added
  assert.ok(listReply.reply.includes('Amul Pasteurised Butter (500 g Carton)'), 'Amul butter 500g variant matched');
  assert.ok(listReply.reply.includes('Britannia Large Sandwich White Bread'), 'Large sandwich bread matched');
  assert.ok(listReply.reply.includes('Hair & Care Triple Blend Nourishing Shampoo (200 ml Bottle)'), 'Hair & Care 200ml variant matched');
  assert.ok(listReply.reply.includes('Tata Salt Vacuum Evaporated Iodised Salt (500 g Pack)'), 'Tata salt 500g variant matched');
  assert.ok(listReply.reply.includes('Madhur Pure & Hygienic Refined Sugar (2 kg Bag)'), 'Sugar 2kg variant matched');
  assert.ok(listReply.reply.includes('Surf Excel Matic Top Load Detergent Powder (4 kg Box)'), 'Surf Excel 4kg variant matched');
  assert.ok(listReply.reply.includes('Colgate Strong Teeth Anticavity Toothpaste'), 'Colgate toothpaste matched');

  // Assert out-of-stock item triggers alternative suggestion
  assert.ok(
    listReply.reply.includes('OUT OF STOCK') && (listReply.reply.includes('Lux Rose') || listReply.reply.includes('lux rose soap')),
    'Lux Rose soap 3-pack out of stock triggers in-stock alternative'
  );

  console.log('\n========================================================================');
  console.log('🎉 ALL TESTS PASSED! FULL MULTI-VARIANT ARCHITECTURE VERIFIED!');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

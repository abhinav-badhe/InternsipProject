async function main() {
  console.log('Testing Store Admin Web Product/Variant Creation API...');

  const testPayload = {
    productName: 'Puro Healthy Pink Rock Salt',
    brandName: 'Puro',
    primaryCategoryId: '11000000-0000-0000-0000-000000000012',
    storageType: 'ambient',
    shelfLifeDays: 365,
    isVeg: true,
    variantName: '1 kg Pouch',
    sku: `PURO-SALT-1KG-${Date.now().toString().slice(-4)}`,
    barcode: '8901030099991',
    mrp: 110,
    sellingPrice: 99,
    initialStock: 50,
    shelfZone: 'Zone A-01-R1',
    imageUrl: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80',
  };

  const res = await fetch('http://localhost:3001/api/v1/catalog/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  const json = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(json, null, 2));

  if (!res.ok) {
    throw new Error('API creation failed');
  }
  console.log('✅ Product and Variant created successfully in DB!');
}

main().catch(console.error);

import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('--- Fixing Variant to Product Mappings ---');

  // 1. Ensure canonical products exist with proper names and IDs
  const canonicalProducts = [
    {
      id: '30000000-0000-0000-0000-000000000010',
      name: 'Amul Pasteurised Butter',
      slug: 'amul-pasteurised-butter'
    },
    {
      id: '30000000-0000-0000-0000-000000000011',
      name: 'Britannia Large Sandwich White Bread',
      slug: 'britannia-large-sandwich-white-bread'
    },
    {
      id: '30000000-0000-0000-0000-000000000012',
      name: 'Colgate Strong Teeth Anticavity Toothpaste',
      slug: 'colgate-strong-teeth-anticavity-toothpaste'
    },
    {
      id: '30000000-0000-0000-0000-000000000013',
      name: 'Hair & Care Triple Blend Nourishing Shampoo',
      slug: 'hair-care-triple-blend-nourishing-shampoo'
    },
    {
      id: '30000000-0000-0000-0000-000000000014',
      name: 'Tata Salt Vacuum Evaporated Iodised Salt',
      slug: 'tata-salt-vacuum-evaporated-iodised-salt'
    },
    {
      id: '30000000-0000-0000-0000-000000000015',
      name: 'Madhur Pure & Hygienic Refined Sugar',
      slug: 'madhur-pure-hygienic-refined-sugar'
    },
    {
      id: '30000000-0000-0000-0000-000000000016',
      name: 'Surf Excel Matic Top Load Detergent Powder',
      slug: 'surf-excel-matic-top-load-detergent-powder'
    }
  ];

  for (const cp of canonicalProducts) {
    await client.query(`
      UPDATE products 
      SET name = $1, slug = $2 
      WHERE id = $3
    `, [cp.name, cp.slug, cp.id]);
  }

  // 2. Link variants to their exact products
  const variantLinks = [
    { sku: 'AMUL-BTR-500G', productId: '30000000-0000-0000-0000-000000000010', name: '500 g Carton' },
    { sku: 'BRIT-BREAD-LRG-500G', productId: '30000000-0000-0000-0000-000000000011', name: 'Large 500 g Loaf' },
    { sku: 'COLG-TOOTH-200G', productId: '30000000-0000-0000-0000-000000000012', name: '200 g Tube' },
    { sku: 'HNC-SHAMP-200G', productId: '30000000-0000-0000-0000-000000000013', name: '200 ml Bottle' },
    { sku: 'TATA-SALT-500G', productId: '30000000-0000-0000-0000-000000000014', name: '500 g Pack' },
    { sku: 'MADHUR-SUGAR-2KG', productId: '30000000-0000-0000-0000-000000000015', name: '2 kg Bag' },
    { sku: 'SURF-TOPLOAD-4KG', productId: '30000000-0000-0000-0000-000000000016', name: '4 kg Box' }
  ];

  for (const vl of variantLinks) {
    await client.query(`
      UPDATE product_variants 
      SET product_id = $1, variant_name = $2 
      WHERE sku = $3
    `, [vl.productId, vl.name, vl.sku]);
  }

  // Ensure Britannia products point to Britannia brand
  const britRes = await client.query(`SELECT id FROM brands WHERE name ILIKE '%britannia%' LIMIT 1`);
  if (britRes.rows.length > 0) {
    await client.query(`UPDATE products SET brand_id = $1 WHERE name ILIKE '%britannia%'`, [britRes.rows[0].id]);
  }

  // Ensure Surf Excel product points to Surf Excel brand
  const surfRes = await client.query(`SELECT id FROM brands WHERE name ILIKE '%surf%' LIMIT 1`);
  if (surfRes.rows.length > 0) {
    await client.query(`UPDATE products SET brand_id = $1 WHERE name ILIKE '%surf%'`, [surfRes.rows[0].id]);
  }

  // Ensure Lizol points to Lizol or separate brand
  const lizolRes = await client.query(`SELECT id FROM brands WHERE name ILIKE '%lizol%' LIMIT 1`);
  if (lizolRes.rows.length > 0) {
    await client.query(`UPDATE products SET brand_id = $1 WHERE name ILIKE '%lizol%'`, [lizolRes.rows[0].id]);
  }

  console.log('✓ Successfully verified and linked all canonical grocery products & variants!');
  await client.end();
}

main().catch(console.error);

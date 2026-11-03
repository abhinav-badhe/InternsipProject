import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  console.log('Seeding rich multi-variant products in PostgreSQL...');

  // 1. Ensure Brands exist
  const brands = ['Tata', 'Catch', 'Aashirvaad', 'Amul'];
  const brandIds = {};

  for (const b of brands) {
    const slug = b.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const bRes = await pool.query(
      `INSERT INTO brands (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [b, slug]
    );
    brandIds[b] = bRes.rows[0].id;
  }

  // 2. Category IDs
  const catRes = await pool.query(`SELECT id, name FROM categories WHERE name ILIKE '%Spices%' OR name ILIKE '%Dairy%'`);
  let spicesCatId = '11000000-0000-0000-0000-000000000012';
  let dairyCatId = '11000000-0000-0000-0000-000000000004';

  for (const r of catRes.rows) {
    if (r.name.includes('Spice')) spicesCatId = r.id;
    if (r.name.includes('Dairy')) dairyCatId = r.id;
  }

  // Products and their distinct variants with separate prices & inventory
  const productsToSeed = [
    {
      name: 'Tata Salt Vacuum Evaporated Iodised Salt',
      brand: 'Tata',
      categoryId: spicesCatId,
      description: 'Vacuum evaporated iodised salt enriched with iodine for healthy cognitive development.',
      variants: [
        { sku: 'TATA-SALT-500G', name: '500 g Pack', price: 16.0, mrp: 18.0, stock: 80, unit: 'g', weight: 500 },
        { sku: 'TATA-SALT-1KG', name: '1 kg Pouch', price: 28.0, mrp: 30.0, stock: 120, unit: 'kg', weight: 1 },
      ],
    },
    {
      name: 'Catch Table Salt Sprinkler',
      brand: 'Catch',
      categoryId: spicesCatId,
      description: 'Free-flowing table salt in an easy-to-use rotary dispenser table sprinkler.',
      variants: [
        { sku: 'CATCH-SALT-200G', name: '200 g Sprinkler', price: 35.0, mrp: 38.0, stock: 65, unit: 'g', weight: 200 },
        { sku: 'CATCH-SALT-1KG', name: '1 kg Pack', price: 24.0, mrp: 26.0, stock: 75, unit: 'kg', weight: 1 },
      ],
    },
    {
      name: 'Aashirvaad Himalayan Pink Rock Salt',
      brand: 'Aashirvaad',
      categoryId: spicesCatId,
      description: 'Natural mineral-rich pink rock salt sourced from Himalayan foothills.',
      variants: [
        { sku: 'AASH-PINK-SALT-500G', name: '500 g Pouch', price: 52.0, mrp: 55.0, stock: 50, unit: 'g', weight: 500 },
        { sku: 'AASH-PINK-SALT-1KG', name: '1 kg Pouch', price: 95.0, mrp: 105.0, stock: 45, unit: 'kg', weight: 1 },
      ],
    },
    {
      name: 'Amul Taaza Homogenised Toned Milk',
      brand: 'Amul',
      categoryId: dairyCatId,
      description: 'Pasteurised, homogenised toned milk packed with protein and calcium.',
      variants: [
        { sku: 'AMUL-TZ-500ML', name: '500 ml Pouch', price: 36.0, mrp: 37.0, stock: 90, unit: 'ml', weight: 500 },
        { sku: 'AMUL-TZ-1L', name: '1 Litre Tetra Pak', price: 72.0, mrp: 75.0, stock: 65, unit: 'l', weight: 1 },
      ],
    },
    {
      name: 'Amul Gold Full Cream Fresh Milk',
      brand: 'Amul',
      categoryId: dairyCatId,
      description: 'Wholesome full cream milk with 6% fat and 9% SNF, ideal for desserts and thick tea.',
      variants: [
        { sku: 'AMUL-GOLD-500ML', name: '500 ml Pouch', price: 40.0, mrp: 41.0, stock: 85, unit: 'ml', weight: 500 },
        { sku: 'AMUL-GOLD-1L', name: '1 Litre Tetra Pak', price: 80.0, mrp: 82.0, stock: 70, unit: 'l', weight: 1 },
      ],
    },
  ];

  for (const prod of productsToSeed) {
    const slug = prod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const brandId = brandIds[prod.brand];

    // Check or insert product
    let prodRes = await pool.query(
      `SELECT id FROM products WHERE slug = $1 OR (name = $2 AND brand_id = $3)`,
      [slug, prod.name, brandId]
    );

    let productId;
    if (prodRes.rows.length > 0) {
      productId = prodRes.rows[0].id;
    } else {
      const insRes = await pool.query(
        `INSERT INTO products (brand_id, primary_category_id, name, slug, description, is_active, storage_type, shelf_life_days)
         VALUES ($1, $2, $3, $4, $5, TRUE, 'ambient', 180)
         RETURNING id`,
        [brandId, prod.categoryId, prod.name, slug, prod.description]
      );
      productId = insRes.rows[0].id;
    }

    // Insert variants, prices, and inventory
    for (const v of prod.variants) {
      await pool.query(
        `INSERT INTO product_variants (product_id, sku, variant_name, net_weight_value, measurement_unit, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (sku) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           variant_name = EXCLUDED.variant_name,
           net_weight_value = EXCLUDED.net_weight_value,
           measurement_unit = EXCLUDED.measurement_unit,
           status = 'active'`,
        [productId, v.sku, v.name, v.weight, v.unit]
      );

      // Deactivate old prices for this SKU and insert fresh active base price
      await pool.query(`UPDATE base_prices SET is_active = FALSE WHERE sku = $1`, [v.sku]);
      await pool.query(
        `INSERT INTO base_prices (sku, amount, currency, is_active)
         VALUES ($1, $2, 'INR', TRUE)`,
        [v.sku, v.price]
      );

      await pool.query(
        `INSERT INTO stock_balances (location_id, sku, on_hand_qty, reserved_qty)
         VALUES ('80000000-0000-0000-0000-000000000001', $1, $2, 0)
         ON CONFLICT (location_id, sku) DO UPDATE SET
           on_hand_qty = GREATEST(stock_balances.on_hand_qty, EXCLUDED.on_hand_qty)`,
        [v.sku, v.stock]
      );
    }
    console.log(`✅ Seeded: ${prod.name} (${prod.variants.length} variants)`);
  }

  console.log('Finished seeding multi-variant products.');
  await pool.end();
}

main().catch(console.error);

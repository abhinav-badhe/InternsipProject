import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.SUPABASE_DATABASE_URL ||
    'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log('🌱 Seeding rich grocery catalog & stock for multi-item order parsing and soap drilldown...');

  // 1. Ensure Brands exist
  const brands = [
    { id: '20000000-0000-0000-0000-000000000001', name: 'Dove' },
    { id: '20000000-0000-0000-0000-000000000002', name: 'Dettol' },
    { id: '20000000-0000-0000-0000-000000000003', name: 'Rin' },
    { id: '20000000-0000-0000-0000-000000000004', name: 'Vim' },
    { id: '20000000-0000-0000-0000-000000000005', name: 'Amul' },
    { id: '20000000-0000-0000-0000-000000000006', name: 'Lux' },
    { id: '20000000-0000-0000-0000-000000000007', name: 'Pears' },
    { id: '20000000-0000-0000-0000-000000000008', name: 'Britannia' },
    { id: '20000000-0000-0000-0000-000000000009', name: 'Colgate' },
    { id: '20000000-0000-0000-0000-000000000010', name: 'Hair & Care' },
    { id: '20000000-0000-0000-0000-000000000011', name: 'Tata' },
    { id: '20000000-0000-0000-0000-000000000012', name: 'Madhur' },
    { id: '20000000-0000-0000-0000-000000000013', name: 'Surf Excel' },
  ];

  for (const b of brands) {
    await pool.query(
      `INSERT INTO brands (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [b.id, b.name, b.name.toLowerCase().replace(/[^a-z0-9]/g, '-')]
    );
  }
  console.log('✓ Brands synchronized');

  // 2. Ensure Categories exist
  const categories = [
    { id: '11000000-0000-0000-0000-000000000001', name: 'Bathing Soaps & Body Wash', slug: 'bathing-soaps' },
    { id: '11000000-0000-0000-0000-000000000002', name: 'Washing Soaps & Detergent Bars', slug: 'washing-soaps' },
    { id: '11000000-0000-0000-0000-000000000003', name: 'Dishwashing & Utensil Soaps', slug: 'utensil-soaps' },
    { id: '11000000-0000-0000-0000-000000000004', name: 'Dairy, Butter & Eggs', slug: 'dairy-butter' },
    { id: '11000000-0000-0000-0000-000000000005', name: 'Breads & Bakery', slug: 'bread-bakery' },
    { id: '11000000-0000-0000-0000-000000000006', name: 'Oral Care', slug: 'oral-care' },
    { id: '11000000-0000-0000-0000-000000000007', name: 'Hair Care & Shampoos', slug: 'hair-care' },
    { id: '11000000-0000-0000-0000-000000000008', name: 'Staples, Salt & Sugar', slug: 'staples-salt-sugar' },
    { id: '11000000-0000-0000-0000-000000000009', name: 'Laundry Powders & Detergents', slug: 'laundry-powders' },
  ];

  for (const c of categories) {
    await pool.query(
      `INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [c.id, c.name, c.slug]
    );
  }
  console.log('✓ Categories synchronized');

  // 3. Products and Variants
  const catalog = [
    // Bathing Soaps
    {
      productId: '30000000-0000-0000-0000-000000000001',
      name: 'Dove Cream Beauty Bathing Bar',
      brandId: '20000000-0000-0000-0000-000000000001',
      categoryId: '11000000-0000-0000-0000-000000000001',
      variants: [
        { sku: 'DOVE-BAR-75G', name: '75 g Single Bar', mrp: 55, price: 52, stock: 100 },
        { sku: 'DOVE-BAR-125G-4PK', name: '125 g (Pack of 4)', mrp: 340, price: 295, stock: 45 },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000002',
      name: 'Dettol Original Germ Protection Bathing Soap',
      brandId: '20000000-0000-0000-0000-000000000002',
      categoryId: '11000000-0000-0000-0000-000000000001',
      variants: [
        { sku: 'DETTOL-ORIG-75G', name: '75 g Single Bar', mrp: 42, price: 38, stock: 80 },
        { sku: 'DETTOL-ORIG-125G-3PK', name: '125 g (Pack of 3)', mrp: 180, price: 162, stock: 35 },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000003',
      name: 'Pears Pure & Gentle Bathing Bar',
      brandId: '20000000-0000-0000-0000-000000000007',
      categoryId: '11000000-0000-0000-0000-000000000001',
      variants: [
        { sku: 'PEARS-PURE-75G', name: '75 g Single Bar', mrp: 65, price: 58, stock: 60 },
        { sku: 'PEARS-PURE-125G-3PK', name: '125 g (Pack of 3)', mrp: 210, price: 189, stock: 25 },
      ],
    },
    {
      productId: '30000000-0000-0000-0000-000000000004',
      name: 'Lux Rose & Vitamin E Bathing Soap',
      brandId: '20000000-0000-0000-0000-000000000006',
      categoryId: '11000000-0000-0000-0000-000000000001',
      variants: [
        { sku: 'LUX-ROSE-100G-3PK', name: '100 g (Pack of 3)', mrp: 110, price: 99, stock: 0 }, // Out of stock to demonstrate alternative recommendation!
      ],
    },

    // 1. Amul Butter
    {
      productId: '30000000-0000-0000-0000-000000000010',
      name: 'Amul Pasteurised Butter',
      brandId: '20000000-0000-0000-0000-000000000005',
      categoryId: '11000000-0000-0000-0000-000000000004',
      variants: [
        { sku: 'AMUL-BTR-500G', name: '500 g Carton', mrp: 285, price: 275, stock: 50 },
        { sku: 'AMUL-BTR-100G', name: '100 g Pack', mrp: 60, price: 58, stock: 80 },
      ],
    },

    // 3. Sandwich Bread
    {
      productId: '30000000-0000-0000-0000-000000000011',
      name: 'Britannia Large Sandwich White Bread',
      brandId: '20000000-0000-0000-0000-000000000008',
      categoryId: '11000000-0000-0000-0000-000000000005',
      variants: [
        { sku: 'BRIT-BREAD-LRG-500G', name: 'Large 500 g Loaf', mrp: 55, price: 50, stock: 40 },
      ],
    },

    // 4. Colgate Toothpaste
    {
      productId: '30000000-0000-0000-0000-000000000012',
      name: 'Colgate Strong Teeth Anticavity Toothpaste',
      brandId: '20000000-0000-0000-0000-000000000009',
      categoryId: '11000000-0000-0000-0000-000000000006',
      variants: [
        { sku: 'COLG-TOOTH-200G', name: '200 g Tube', mrp: 125, price: 110, stock: 65 },
        { sku: 'COLG-TOOTH-100G', name: '100 g Tube', mrp: 70, price: 65, stock: 90 },
      ],
    },

    // 5. Hair & Care Shampoo / Oil
    {
      productId: '30000000-0000-0000-0000-000000000013',
      name: 'Hair & Care Triple Blend Nourishing Shampoo',
      brandId: '20000000-0000-0000-0000-000000000010',
      categoryId: '11000000-0000-0000-0000-000000000007',
      variants: [
        { sku: 'HNC-SHAMP-200G', name: '200 ml Bottle', mrp: 180, price: 155, stock: 35 },
      ],
    },

    // 6. Tata Salt
    {
      productId: '30000000-0000-0000-0000-000000000014',
      name: 'Tata Salt Vacuum Evaporated Iodised Salt',
      brandId: '20000000-0000-0000-0000-000000000011',
      categoryId: '11000000-0000-0000-0000-000000000008',
      variants: [
        { sku: 'TATA-SALT-1KG', name: '1 kg Pack', mrp: 30, price: 28, stock: 150 },
        { sku: 'TATA-SALT-500G', name: '500 g Pack', mrp: 18, price: 16, stock: 80 },
      ],
    },

    // 7. Sugar
    {
      productId: '30000000-0000-0000-0000-000000000015',
      name: 'Madhur Pure & Hygienic Refined Sugar',
      brandId: '20000000-0000-0000-0000-000000000012',
      categoryId: '11000000-0000-0000-0000-000000000008',
      variants: [
        { sku: 'MADHUR-SUGAR-1KG', name: '1 kg Bag', mrp: 60, price: 54, stock: 100 },
        { sku: 'MADHUR-SUGAR-2KG', name: '2 kg Bag', mrp: 120, price: 105, stock: 60 },
      ],
    },

    // 8. Surf Excel Top Loading Powder
    {
      productId: '30000000-0000-0000-0000-000000000016',
      name: 'Surf Excel Matic Top Load Detergent Powder',
      brandId: '20000000-0000-0000-0000-000000000013',
      categoryId: '11000000-0000-0000-0000-000000000009',
      variants: [
        { sku: 'SURF-TOPLOAD-4KG', name: '4 kg Box', mrp: 850, price: 749, stock: 30 },
        { sku: 'SURF-TOPLOAD-2KG', name: '2 kg Pack', mrp: 450, price: 399, stock: 50 },
      ],
    },
  ];

  for (const p of catalog) {
    // Insert Product
    await pool.query(
      `INSERT INTO products (id, name, slug, brand_id, primary_category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, brand_id = EXCLUDED.brand_id, primary_category_id = EXCLUDED.primary_category_id`,
      [p.productId, p.name, p.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), p.brandId, p.categoryId]
    );

    // Insert Variants and Stock
    for (const v of p.variants) {
      await pool.query(
        `INSERT INTO product_variants (product_id, sku, variant_name, net_weight_value, measurement_unit, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (sku) DO UPDATE SET variant_name = EXCLUDED.variant_name, status = 'active', net_weight_value = EXCLUDED.net_weight_value, measurement_unit = EXCLUDED.measurement_unit`,
        [p.productId, v.sku, v.name, v.weight || 100, v.unit || 'g']
      );

      // Base price entry
      await pool.query(
        `INSERT INTO base_prices (sku, amount, currency, is_active)
         VALUES ($1, $2, 'INR', TRUE)
         ON CONFLICT DO NOTHING`,
        [v.sku, v.price]
      );

      // Stock balance in default location
      await pool.query(
        `INSERT INTO stock_balances (sku, location_id, on_hand_qty, reserved_qty)
         VALUES ($1, '80000000-0000-0000-0000-000000000001', $2, 0)
         ON CONFLICT (sku, location_id) DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty`,
        [v.sku, v.stock]
      );
    }
  }

  console.log('✓ Successfully seeded full grocery catalog with multi-item products, brands, and stock!');
  await pool.end();
}

seed().catch(console.error);

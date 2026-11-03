import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- VERIFYING CATEGORY IMAGES ---');
  const cats = await pool.query(`SELECT id, name, image_url FROM categories WHERE image_url IS NOT NULL ORDER BY name`);
  console.log(`Found ${cats.rows.length} categories with images:`);
  cats.rows.slice(0, 5).forEach(c => console.log(`  - [${c.name}] => ${c.image_url}`));

  console.log('\n--- VERIFYING BRAND LOGOS ---');
  const brands = await pool.query(`SELECT id, name, logo_url FROM brands WHERE logo_url IS NOT NULL ORDER BY name`);
  console.log(`Found ${brands.rows.length} brands with logos:`);
  brands.rows.slice(0, 5).forEach(b => console.log(`  - [${b.name}] => ${b.logo_url}`));

  console.log('\n--- VERIFYING PRODUCTS & VARIANTS WITH PUBLIC IMAGES ---');
  const variants = await pool.query(`
    SELECT p.name as product_name, c.name as category_name, b.name as brand_name,
           v.sku, v.variant_name, v.image_urls, bp.amount as price, sb.on_hand_qty as stock
    FROM product_variants v
    JOIN products p ON v.product_id = p.id
    JOIN categories c ON p.primary_category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN base_prices bp ON v.sku = bp.sku
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    ORDER BY c.name, p.name, v.sku
  `);

  console.log(`Found ${variants.rows.length} total product variants in database:`);
  variants.rows.forEach((v, idx) => {
    const img = v.image_urls?.[0] || 'NONE';
    console.log(`${idx + 1}. [${v.category_name}] ${v.product_name} (${v.variant_name}) | SKU: ${v.sku} | Price: ₹${v.price} | Stock: ${v.stock} | Image: ${img.substring(0, 60)}...`);
  });

  await pool.end();
}

main().catch(console.error);

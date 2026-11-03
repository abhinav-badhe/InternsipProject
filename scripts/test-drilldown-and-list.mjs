import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- TEST 1: Get brands for category Bathing Soaps (11000000-0000-0000-0000-000000000001) ---');
  const catId = '11000000-0000-0000-0000-000000000001';
  const brandsRes = await pool.query(`
    SELECT DISTINCT b.id, b.name,
      COUNT(v.id) as variant_count,
      COALESCE(SUM(sb.on_hand_qty - sb.reserved_qty), 0) as total_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.primary_category_id = $1 AND p.is_active = TRUE AND v.status = 'active'
    GROUP BY b.id, b.name
    ORDER BY total_stock DESC, b.name ASC
  `, [catId]);
  console.log(brandsRes.rows);

  console.log('\n--- TEST 2: Get variants for brand Dove in Bathing Soaps ---');
  const variantsRes = await pool.query(`
    SELECT p.name as product_name, b.name as brand_name,
      v.sku, v.variant_name, v.net_weight_value, v.measurement_unit,
      COALESCE(bp.amount, 50) as selling_price,
      COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE (b.name ILIKE $1 OR b.id::text = $1)
      AND ($2::uuid IS NULL OR p.primary_category_id = $2)
      AND v.status = 'active'
    ORDER BY available_stock DESC, v.sku ASC
  `, ['Dove', catId]);
  console.log(variantsRes.rows);

  console.log('\n--- TEST 3: Find in-stock alternative for Bathing Soaps ---');
  const altRes = await pool.query(`
    SELECT p.name as product_name, b.name as brand_name,
      v.sku, v.variant_name,
      COALESCE(bp.amount, 50) as selling_price,
      COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.primary_category_id = $1
      AND (sb.on_hand_qty - sb.reserved_qty) > 0
      AND v.status = 'active'
    ORDER BY (sb.on_hand_qty - sb.reserved_qty) DESC
    LIMIT 1
  `, [catId]);
  console.log(altRes.rows);

  console.log('\n--- TEST 4: Search product "amul butter 500" ---');
  const searchRes = await pool.query(`
    SELECT p.name as product_name, b.name as brand_name,
      v.sku, v.variant_name,
      COALESCE(bp.amount, 50) as selling_price,
      COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE (p.name ILIKE '%amul%butter%' OR v.variant_name ILIKE '%500%')
      AND v.status = 'active'
    ORDER BY available_stock DESC
    LIMIT 1
  `);
  console.log(searchRes.rows);

  await pool.end();
}

main().catch(console.error);

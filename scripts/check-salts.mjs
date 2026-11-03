import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const salts = await pool.query(`
    SELECT DISTINCT p.id as product_id, p.name as product, b.name as brand, v.sku, v.variant_name,
           bp.amount as price, sb.on_hand_qty - sb.reserved_qty as available_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.name ILIKE '%salt%' OR v.variant_name ILIKE '%salt%'
    ORDER BY p.name, v.variant_name
  `);
  console.log('Distinct salt variants in DB:');
  console.table(salts.rows);

  const milks = await pool.query(`
    SELECT DISTINCT p.id as product_id, p.name as product, b.name as brand, v.sku, v.variant_name,
           bp.amount as price, sb.on_hand_qty - sb.reserved_qty as available_stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.name ILIKE '%milk%' OR v.variant_name ILIKE '%milk%'
    ORDER BY p.name, v.variant_name
  `);
  console.log('Distinct milk variants in DB:');
  console.table(milks.rows);

  await pool.end();
}

main().catch(console.error);

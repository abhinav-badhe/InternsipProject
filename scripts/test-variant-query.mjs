import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function getVariantsForProductOrQuery(searchTerm, brandName) {
  const res = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT p.id as product_id, p.name as product_name, b.name as brand_name,
              v.sku, v.variant_name, v.net_weight_value, v.measurement_unit,
              COALESCE(bp.amount, 50) as selling_price,
              COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as available_stock
       FROM products p
       JOIN brands b ON p.brand_id = b.id
       JOIN product_variants v ON p.id = v.product_id
       LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
       LEFT JOIN stock_balances sb ON v.sku = sb.sku
       WHERE v.status = 'active'
         AND ($2::text IS NULL OR b.name ILIKE ('%' || $2 || '%'))
         AND (p.name ILIKE ('%' || $1 || '%') OR v.variant_name ILIKE ('%' || $1 || '%'))
     ) sub
     WHERE available_stock > 0
     ORDER BY available_stock DESC, sku ASC
     LIMIT 6`,
    [searchTerm, brandName || null]
  );
  const seen = new Set();
  const deduped = [];
  for (const row of res.rows) {
    if (!seen.has(row.sku)) {
      seen.add(row.sku);
      deduped.push(row);
    }
  }
  return deduped;
}

async function main() {
  console.log('--- Testing query: "salt" ---');
  const saltVars = await getVariantsForProductOrQuery('salt', null);
  console.table(saltVars.map(v => ({ brand: v.brand_name, product: v.product_name, variant: v.variant_name, price: v.selling_price, stock: v.available_stock, sku: v.sku })));

  console.log('\n--- Testing query: "milk" (Amul) ---');
  const milkVars = await getVariantsForProductOrQuery('milk', 'Amul');
  console.table(milkVars.map(v => ({ brand: v.brand_name, product: v.product_name, variant: v.variant_name, price: v.selling_price, stock: v.available_stock, sku: v.sku })));

  await pool.end();
}

main().catch(console.error);

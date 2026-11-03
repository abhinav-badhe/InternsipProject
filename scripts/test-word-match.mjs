import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function testQuery(searchTerm) {
  const words = searchTerm
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3);

  const wordConditions = words.map((_, i) =>
    `(p.name ILIKE ('%' || $${i + 1} || '%') OR b.name ILIKE ('%' || $${i + 1} || '%') OR v.variant_name ILIKE ('%' || $${i + 1} || '%'))`
  ).join(' AND ');

  const sql = `
    SELECT DISTINCT p.name as product, b.name as brand, v.sku, v.variant_name,
           COALESCE(bp.amount, 50) as price, COALESCE(sb.on_hand_qty, 0) as stock
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = TRUE
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE v.status = 'active'
      AND (${wordConditions || 'TRUE'})
    ORDER BY p.name, v.sku
  `;

  const res = await pool.query(sql, words);
  console.log(`=== Query: "${searchTerm}" -> Found ${res.rows.length} variants:`);
  console.table(res.rows);
}

async function main() {
  await testQuery('colgate toothpaste');
  await testQuery('amul butter');
  await testQuery('tata salt');
  await testQuery('sugar');
  await testQuery('surf excel');
  await pool.end();
}

main().catch(console.error);


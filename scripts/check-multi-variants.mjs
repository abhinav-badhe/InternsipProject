import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const multiVariants = await pool.query(`
    SELECT p.id, p.name as product, b.name as brand, COUNT(DISTINCT v.sku) as variant_count,
           STRING_AGG(DISTINCT v.variant_name || ' (' || v.sku || ')', ', ') as variants
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    GROUP BY p.id, p.name, b.name
    HAVING COUNT(DISTINCT v.sku) > 1
    ORDER BY variant_count DESC
  `);
  console.log(`Products with multiple variants (${multiVariants.rows.length}):`);
  console.table(multiVariants.rows.slice(0, 20));

  await pool.end();
}

main().catch(console.error);

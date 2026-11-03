import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const skus = [
    'AMUL-BTR-100G', 'AMUL-BTR-500G',
    'LUX-ROSE-100G', 'LUX-ROSE-100G-3PK',
    'BRIT-BREAD-REG-400G', 'BRIT-BREAD-LRG-500G',
    'COLG-TOOTH-100G', 'COLG-TOOTH-200G',
    'HNC-SHAMP-100G', 'HNC-SHAMP-200G',
    'TATA-SALT-500G', 'TATA-SALT-1KG',
    'MADHUR-SUGAR-1KG', 'MADHUR-SUGAR-2KG', 'MADHUR-SUGAR-5KG',
    'SURF-TOPLOAD-1KG', 'SURF-TOPLOAD-2KG', 'SURF-TOPLOAD-4KG'
  ];

  const res = await pool.query(
    `SELECT p.name as product_name, pv.sku, pv.variant_name,
            COALESCE(bp.amount, 0) as price, COALESCE(sb.on_hand_qty, 0) as stock
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     LEFT JOIN (
       SELECT DISTINCT ON (sku) sku, amount FROM base_prices WHERE is_active = TRUE ORDER BY sku, created_at DESC
     ) bp ON pv.sku = bp.sku
     LEFT JOIN stock_balances sb ON pv.sku = sb.sku
     WHERE pv.sku = ANY($1::text[])
     ORDER BY p.name, pv.sku`,
    [skus]
  );

  console.log(`Found ${res.rows.length} of ${skus.length} target SKUs in database:`);
  console.table(res.rows);

  const foundSet = new Set(res.rows.map(r => r.sku));
  const missing = skus.filter(s => !foundSet.has(s));
  console.log('Missing SKUs:', missing);

  await pool.end();
}

main().catch(console.error);


import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT p.id as product_id, p.name as product_name, b.name as brand_name, c.name as category_name,
           v.id as variant_id, v.sku, v.variant_name, bp.amount as base_price,
           sb.on_hand_qty, sb.reserved_qty, (sb.on_hand_qty - sb.reserved_qty) as available
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN categories c ON p.primary_category_id = c.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE v.sku IN (
      'AMUL-BTR-500G', 'LUX-ROSE-100G-3PK', 'BRIT-BREAD-LRG-500G',
      'COLG-TOOTH-200G', 'COLG-TOOTH-100G', 'HNC-SHAMP-200G',
      'TATA-SALT-500G', 'TATA-SALT-1KG', 'MADHUR-SUGAR-2KG', 'MADHUR-SUGAR-1KG',
      'SURF-TOPLOAD-4KG', 'SURF-TOPLOAD-2KG'
    )
    ORDER BY p.name, v.sku;
  `);

  console.log(`Found ${res.rows.length} items:`);
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);

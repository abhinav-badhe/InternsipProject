import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const bCols = await pool.query("SELECT id, name FROM brands");
  console.log('Brands:', bCols.rows);

  const items = await pool.query(`
    SELECT p.id as product_id, p.name as product_name, b.name as brand_name,
           c.id as category_id, c.name as category_name,
           v.id as variant_id, v.sku, v.variant_name,
           sb.on_hand_qty, sb.reserved_qty
    FROM products p
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories c ON p.primary_category_id = c.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    ORDER BY c.name, b.name, p.name
  `);
  console.log(`\nTotal seeded product variants: ${items.rows.length}`);
  for (const item of items.rows) {
    console.log(`- [${item.category_name}] ${item.brand_name} - ${item.product_name} | SKU: ${item.sku} | Var: ${item.variant_name} | Stock: ${item.on_hand_qty || 0} (Reserved: ${item.reserved_qty || 0})`);
  }

  await pool.end();
}

main().catch(console.error);

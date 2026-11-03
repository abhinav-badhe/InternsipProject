import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function check() {
  const items = ['butter', 'lux', 'soap', 'bread', 'colgate', 'shampoo', 'salt', 'sugar', 'surf'];
  for (const item of items) {
    const res = await pool.query(
      `SELECT p.id, p.name as product_name, p.primary_category_id, b.name as brand_name, v.sku, v.variant_name, 
              COALESCE(bp.amount, 0) as price, COALESCE(sb.on_hand_qty - sb.reserved_qty, 0) as stock
       FROM products p
       LEFT JOIN brands b ON p.brand_id = b.id
       JOIN product_variants v ON p.id = v.product_id
       LEFT JOIN base_prices bp ON v.sku = bp.sku AND bp.is_active = true
       LEFT JOIN stock_balances sb ON v.sku = sb.sku
       WHERE p.name ILIKE $1 OR b.name ILIKE $1 OR v.variant_name ILIKE $1
       ORDER BY stock DESC
       LIMIT 6`,
      ['%' + item + '%']
    );
    console.log(`=== Matches for "${item}" (${res.rows.length}) ===`);
    for (const r of res.rows) {
      console.log(`  [${r.brand_name}] ${r.product_name} - ${r.variant_name} | SKU: ${r.sku} | ₹${r.price} | Stock: ${r.stock}`);
    }
  }
  await pool.end();
}
check().catch(console.error);


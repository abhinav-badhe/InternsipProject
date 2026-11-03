import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'product_variants'
  `);
  console.log('product_variants columns:');
  console.table(schema.rows);

  const pricingSchema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'base_prices'
  `);
  console.log('base_prices columns:');
  console.table(pricingSchema.rows);

  const saltVariants = await pool.query(`
    SELECT p.id as product_id, p.name as product, b.name as brand, v.sku, v.variant_name, bp.amount as price, sb.on_hand_qty, sb.reserved_qty
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.name ILIKE '%salt%'
  `);
  console.log('Salt variants in DB:');
  console.table(saltVariants.rows);

  const milkVariants = await pool.query(`
    SELECT p.id as product_id, p.name as product, b.name as brand, v.sku, v.variant_name, bp.amount as price, sb.on_hand_qty, sb.reserved_qty
    FROM products p
    JOIN brands b ON p.brand_id = b.id
    JOIN product_variants v ON p.id = v.product_id
    LEFT JOIN base_prices bp ON v.sku = bp.sku
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    WHERE p.name ILIKE '%milk%'
  `);
  console.log('Milk variants in DB:');
  console.table(milkVariants.rows);

  await pool.end();
}

main().catch(console.error);

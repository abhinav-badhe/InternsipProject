import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- Cleaning up product variant relationships ---');

  // Ensure Milk belongs to Amul Milk
  await pool.query(`
    INSERT INTO products (id, name, slug, brand_id, primary_category_id, is_active)
    VALUES ('30000000-0000-0000-0000-000000000020', 'Amul Taaza Toned Milk', 'amul-taaza-milk', '20000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000004', TRUE)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, brand_id = EXCLUDED.brand_id;
  `);

  await pool.query(`
    UPDATE product_variants
    SET product_id = '30000000-0000-0000-0000-000000000020'
    WHERE sku IN ('AMUL-TZ-500ML', 'AMUL-TZ-1L');
  `);

  // Ensure Lux Rose Soap ONLY has LUX-ROSE-100G-3PK with 0 stock (Out of Stock)
  await pool.query(`
    UPDATE stock_balances
    SET on_hand_qty = 0, reserved_qty = 0
    WHERE sku = 'LUX-ROSE-100G-3PK';
  `);

  // Ensure Vim Bar belongs to Vim
  await pool.query(`
    INSERT INTO products (id, name, slug, brand_id, primary_category_id, is_active)
    VALUES ('30000000-0000-0000-0000-000000000021', 'Vim Lemon Dishwash Bar', 'vim-dishwash-bar', '20000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000003', TRUE)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, brand_id = EXCLUDED.brand_id;
  `);

  await pool.query(`
    UPDATE product_variants
    SET product_id = '30000000-0000-0000-0000-000000000021'
    WHERE sku IN ('VIM-BAR-150G', 'VIM-BAR-300G-SCRUB');
  `);

  // Ensure Rin Bar belongs to Rin
  await pool.query(`
    INSERT INTO products (id, name, slug, brand_id, primary_category_id, is_active)
    VALUES ('30000000-0000-0000-0000-000000000022', 'Rin Advanced Detergent Bar', 'rin-detergent-bar', '20000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', TRUE)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, brand_id = EXCLUDED.brand_id;
  `);

  await pool.query(`
    UPDATE product_variants
    SET product_id = '30000000-0000-0000-0000-000000000022'
    WHERE sku IN ('RIN-BAR-250G', 'RIN-BAR-500G-2PK');
  `);

  // Verify stock of all 8 items
  const check = await pool.query(`
    SELECT p.name, b.name as brand, v.sku, v.variant_name, sb.on_hand_qty
    FROM product_variants v
    JOIN products p ON v.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN stock_balances sb ON v.sku = sb.sku
    ORDER BY p.name, v.sku
  `);
  console.log('Cleaned products:');
  for (const r of check.rows) {
    console.log(`- ${r.brand} | ${r.name} | ${r.sku} (${r.variant_name}) | Stock: ${r.on_hand_qty}`);
  }

  await pool.end();
}

main().catch(console.error);

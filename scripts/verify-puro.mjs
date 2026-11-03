import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const p = await pool.query(`SELECT sku, amount, is_active FROM base_prices WHERE sku LIKE 'PURO-SALT%'`);
  console.log('Puro base_prices:');
  console.table(p.rows);

  const s = await pool.query(`SELECT sku, on_hand_qty, reserved_qty FROM stock_balances WHERE sku LIKE 'PURO-SALT%'`);
  console.log('Puro stock_balances:');
  console.table(s.rows);

  await pool.end();
}

main().catch(console.error);

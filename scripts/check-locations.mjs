import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const locs = await pool.query(`SELECT id, name, code FROM stock_locations`);
  console.log('Stock locations:');
  console.table(locs.rows);
  await pool.end();
}

main().catch(console.error);

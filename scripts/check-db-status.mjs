import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log(`Found ${tables.rows.length} public tables in Supabase:`);
  
  for (const row of tables.rows) {
    const countRes = await pool.query(`SELECT count(*)::int as count FROM "${row.table_name}"`);
    console.log(`  - ${row.table_name}: ${countRes.rows[0].count} rows`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Error querying Supabase:', err);
  process.exit(1);
});

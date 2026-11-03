import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Total Tables in Supabase:', res.rows.length);
  console.log('Tables:', res.rows.map(r => r.table_name));

  // Check counts
  const tables = [
    'categories', 'brands', 'products', 'product_variants',
    'base_prices', 'stock_balances', 'whatsapp_sessions',
    'whatsapp_processed_messages', 'whatsapp_conversation_history',
    'orders', 'order_items'
  ];

  console.log('\nRecord Counts:');
  for (const t of tables) {
    try {
      const c = await client.query(`SELECT COUNT(*) FROM ${t}`);
      console.log(`- ${t}: ${c.rows[0].count}`);
    } catch (e) {
      console.log(`- ${t}: ERROR (${e.message})`);
    }
  }

  await client.end();
}

main().catch(console.error);

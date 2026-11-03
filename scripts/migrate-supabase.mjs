import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SUPABASE_URL =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres.valzvkrwugwppexzztfd:abhinav5511@aws-0-eu-north-1.pooler.supabase.com:6543/postgres';

const services = [
  'catalog-service',
  'pricing-service',
  'inventory-service',
  'identity-service',
  'order-service',
  'payment-service',
  'fulfillment-service',
  'invoice-service',
  'notification-service',
  'analytics-service',
  'whatsapp-adapter',
];

async function migrateSupabase() {
  console.log(`Connecting to Supabase PostgreSQL at:\n${SUPABASE_URL.replace(/:[^:@]+@/, ':****@')}...\n`);

  const client = new Client({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Successfully connected to Supabase PostgreSQL!');

  // Enable required extensions
  console.log('Ensuring extensions (uuid-ossp, pgcrypto)...');
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  const migrationsBaseDir = path.join(rootDir, 'database', 'service-migrations');

  for (const service of services) {
    const serviceDir = path.join(migrationsBaseDir, service);
    if (!fs.existsSync(serviceDir)) continue;

    const files = fs
      .readdirSync(serviceDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // 001_* schema first, then seed_*

    console.log(`\n========================================`);
    console.log(`Migrating ${service}...`);
    console.log(`========================================`);

    for (const file of files) {
      const filePath = path.join(serviceDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`  Executing: ${file}...`);
      try {
        await client.query(sql);
        console.log(`  ✓ ${file} applied successfully.`);
      } catch (err) {
        console.warn(`  ! Notice in ${file}:`, err.message);
      }
    }
  }

  // Create default store location in inventory if missing
  try {
    const locRes = await client.query('SELECT id FROM stock_locations LIMIT 1');
    if (locRes.rowCount === 0) {
      await client.query(`
        INSERT INTO stock_locations (id, name, zone_code, is_active)
        VALUES ('80000000-0000-0000-0000-000000000001', 'Central Fulfillment Store', 'ZONE-A1', TRUE)
        ON CONFLICT DO NOTHING;
      `);
      console.log('  ✓ Created default stock location.');
    }
  } catch (e) {
    console.warn('Location init note:', e.message);
  }

  // Verify created tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`\nAll migrations completed! Total public tables in Supabase: ${tablesRes.rowCount}`);
  console.log('Tables:', tablesRes.rows.map((r) => r.table_name).join(', '));

  await client.end();
}

migrateSupabase().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

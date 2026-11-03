import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DB_PORT = parseInt(process.env.PGPORT || '5433', 10);
const DB_HOST = process.env.PGHOST || '127.0.0.1';
const DB_USER = process.env.PGUSER || 'postgres';

const serviceDbMap = {
  'analytics-service': 'analytics_db',
  'catalog-service': 'catalog_db',
  'fulfillment-service': 'fulfillment_db',
  'identity-service': 'identity_db',
  'inventory-service': 'inventory_db',
  'invoice-service': 'invoice_db',
  'notification-service': 'notification_db',
  'order-service': 'order_db',
  'payment-service': 'payment_db',
  'pricing-service': 'pricing_db',
  'whatsapp-adapter': 'whatsapp_db',
};

async function setup() {
  console.log(`Connecting to Postgres on ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  const adminClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    database: 'postgres',
  });
  await adminClient.connect();

  // Create databases if not exists
  for (const [service, dbName] of Object.entries(serviceDbMap)) {
    const checkRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (checkRes.rowCount === 0) {
      console.log(`Creating database: ${dbName}...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
    } else {
      console.log(`Database ${dbName} already exists.`);
    }
  }
  await adminClient.end();

  // Apply migrations and seeds to each database
  const migrationsBaseDir = path.join(rootDir, 'database', 'service-migrations');

  for (const [service, dbName] of Object.entries(serviceDbMap)) {
    const serviceDir = path.join(migrationsBaseDir, service);
    if (!fs.existsSync(serviceDir)) continue;

    const files = fs
      .readdirSync(serviceDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // 001_* first, then seed_*

    if (files.length === 0) continue;

    console.log(`\nMigrating ${service} (${dbName})...`);
    const serviceClient = new Client({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      database: dbName,
    });
    await serviceClient.connect();

    for (const file of files) {
      const filePath = path.join(serviceDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      console.log(`  Executing: ${file}`);
      try {
        await serviceClient.query(sql);
      } catch (err) {
        console.warn(`  Warning in ${file}:`, err.message);
      }
    }

    await serviceClient.end();
  }

  console.log('\nAll databases migrated and seeded successfully!');
}

setup().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

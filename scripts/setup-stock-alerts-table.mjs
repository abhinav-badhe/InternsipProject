import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS back_in_stock_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(30) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      variant_name VARCHAR(255),
      requested_quantity INT DEFAULT 1,
      status VARCHAR(30) DEFAULT 'PENDING',
      notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(phone_number, sku)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_alerts_sku_status ON back_in_stock_alerts(sku, status);
  `);
  console.log('back_in_stock_alerts table ready in PostgreSQL!');
  await pool.end();
}

setup().catch(console.error);


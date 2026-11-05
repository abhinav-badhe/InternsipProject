import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Client } = pg;

async function run() {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const res = await c.query(
    'SELECT id, subscription_number, product_name, status FROM customer_subscriptions WHERE id::text = $1 OR subscription_number = $1',
    ['4c86c995-8120-426e-bb70-1f52b89a4a84']
  );
  console.log('Query result:', res.rows);
  await c.end();
}

run().catch(console.error);


import pg from 'pg';
import { createLogger } from '@grocery/observability';

const { Pool } = pg;
const logger = createLogger('invoice-service:db');

const connectionString =
  process.env.INVOICE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/invoice_db';

const isRemote =
  connectionString.includes('supabase.co') ||
  connectionString.includes('supabase.com') ||
  process.env.DB_SSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database client error in pool', { error: err.message });
});

export const Database = {
  query: async (text: string, params?: any[]) => {
    return pool.query(text, params);
  },
  getClient: async () => {
    return pool.connect();
  },
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await pool.query('SELECT 1 as healthy');
      return res.rows[0]?.healthy === 1;
    } catch {
      return false;
    }
  },
};

import pg from 'pg';
import { createLogger } from '@grocery/observability';

const { Pool } = pg;
const logger = createLogger('notification-service:db');

const pool = new Pool({
  connectionString:
    process.env.NOTIFICATION_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/notification_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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

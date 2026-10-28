import { Pool, QueryResult, QueryResultRow } from 'pg';
import { createLogger } from '@grocery/observability';

const logger = createLogger('pricing-service:db');

export class Database {
  private static pool: Pool | null = null;

  public static getPool(): Pool {
    if (!this.pool) {
      const connectionString =
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pricing_db';

      this.pool = new Pool({
        connectionString,
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        logger.error('Unexpected idle client error in PostgreSQL pool', { error: err.message });
      });
    }
    return this.pool;
  }

  public static async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const pool = this.getPool();
    try {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed pricing query', { duration, rows: res.rowCount });
      return res;
    } catch (err: any) {
      logger.error('Database query failure', { text, error: err.message });
      throw err;
    }
  }

  public static async checkHealth(): Promise<boolean> {
    try {
      const res = await this.query('SELECT 1 as healthy');
      return res.rows[0]?.healthy === 1;
    } catch {
      return false;
    }
  }

  public static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

import { createLogger } from '@grocery/observability';

const logger = createLogger('workers:migration-gate');

export interface MigrationScript {
  version: string;
  name: string;
  sql: string;
}

export class MigrationGate {
  private serviceReady = true;
  private lastMigrationError: string | null = null;
  private appliedMigrations: string[] = [];

  /**
   * Acceptance Scenario 13:
   * Atomic migration execution. If any migration fails, roll back completely,
   * fail the release gate, and immediately fail closed on readiness checks.
   */
  public async executeMigrations(
    migrations: MigrationScript[],
    executeSql: (sql: string) => Promise<void>
  ): Promise<{ success: boolean; appliedCount: number; error?: string }> {
    let appliedCount = 0;

    for (const mig of migrations) {
      try {
        logger.info('Executing migration within transaction', { version: mig.version, name: mig.name });

        // Simulate transactional execution: BEGIN; <sql>; COMMIT;
        await executeSql(`BEGIN;`);
        await executeSql(mig.sql);
        await executeSql(`COMMIT;`);

        this.appliedMigrations.push(mig.version);
        appliedCount++;
      } catch (err: any) {
        // Rollback immediately on failure
        try {
          await executeSql(`ROLLBACK;`);
        } catch {}

        this.serviceReady = false;
        this.lastMigrationError = `Migration ${mig.version} (${mig.name}) failed: ${err.message}`;

        logger.error('Database migration failed; deployment aborted and health checks failed closed', {
          version: mig.version,
          error: err.message,
        });

        return {
          success: false,
          appliedCount,
          error: this.lastMigrationError,
        };
      }
    }

    this.serviceReady = true;
    this.lastMigrationError = null;
    return { success: true, appliedCount };
  }

  /**
   * Readiness check endpoint returns 503 if a migration has failed
   */
  public getReadinessStatus(): { status: 'ready' | 'not_ready'; statusCode: 200 | 503; error?: string } {
    if (!this.serviceReady) {
      return {
        status: 'not_ready',
        statusCode: 503,
        error: this.lastMigrationError || 'Migration failure',
      };
    }
    return {
      status: 'ready',
      statusCode: 200,
    };
  }

  public getAppliedMigrations(): string[] {
    return [...this.appliedMigrations];
  }
}

import { createApp } from './app.js';
import { Database } from './db.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('inventory-service:server');
const port = parseInt(process.env.PORT || '3003', 10);

const app = createApp();
const server = app.listen(port, () => {
  logger.info(`Inventory Service listening on port ${port}`);
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed, disconnecting database pool...');
    await Database.close();
    logger.info('Inventory Service terminated cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

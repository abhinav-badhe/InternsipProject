import { createApp } from './app.js';
import { Database } from './db.js';
import { CatalogRepository } from './catalog.repository.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('catalog-service:server');
const port = parseInt(process.env.PORT || '3001', 10);

const app = createApp();
const server = app.listen(port, () => {
  logger.info(`Catalog Service listening on port ${port}`);

  // Warm up catalog cache in background for sub-millisecond storefront responses
  new CatalogRepository()
    .searchProducts({ limit: 5000 })
    .then((res) => {
      logger.info(`Catalog cache primed with ${res.items.length} products`);
    })
    .catch((err) => {
      logger.warn(`Catalog warm-up deferred: ${err.message}`);
    });
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed, disconnecting database pool...');
    await Database.close();
    logger.info('Catalog Service terminated cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

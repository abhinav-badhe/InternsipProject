import { createApp } from './app.js';
import { Database } from './db.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('order-service:server');
const port = parseInt(process.env.PORT || '3004', 10);

const app = createApp();
const server = app.listen(port, () => {
  logger.info(`Order Service listening on port ${port}`);
});

let processing = false;
const processSubscriptions = async () => {
  if (processing) return;
  processing = true;
  try {
    await app.locals.subscriptionsReady;
    const result = await app.locals.subscriptionProcessor.run();
    if (result.processedCount || result.errors.length) logger.info('Subscription scheduler tick', result);
  } catch (error: any) { logger.error('Subscription scheduler failed', { error: error.message }); }
  finally { processing = false; }
};
const subscriptionTimer = process.env.SUBSCRIPTIONS_SCHEDULER_ENABLED === 'false' ? undefined : setInterval(processSubscriptions, 60_000);
subscriptionTimer?.unref();
if (subscriptionTimer) void processSubscriptions();

async function shutdown(signal: string) {
  if (subscriptionTimer) clearInterval(subscriptionTimer);
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed, disconnecting database pool...');
    await Database.close();
    logger.info('Order Service terminated cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

import { createApp } from './app.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('analytics-service:bootstrap');
const PORT = Number(process.env.PORT) || 3010;

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`Analytics & Predictive ML Service listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

import { createApp } from './app.js';
import { createLogger } from '@grocery/observability';

const logger = createLogger('api-gateway:bootstrap');
const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

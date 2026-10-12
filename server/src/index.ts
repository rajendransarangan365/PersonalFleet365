import http from 'http';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { initSocketServer } from './services/socket.service.js';

async function bootstrap() {
  void connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  const port = env.PORT;

  server.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 FleetWise API running on port ${port} (0.0.0.0) [${env.NODE_ENV}] with Socket.IO`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/database.js');
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force kill after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', { reason });
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

void bootstrap();

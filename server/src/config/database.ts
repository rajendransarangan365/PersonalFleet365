import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;
let retryTimer: NodeJS.Timeout | null = null;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    logger.info('✅ MongoDB connected successfully to Atlas cluster');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
      isConnected = false;
      scheduleReconnect();
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, will attempt reconnect...');
      isConnected = false;
      scheduleReconnect();
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`⚠️ MongoDB connection attempt failed: ${errorMsg}`);
    logger.warn('👉 Please ensure MongoDB Atlas Network Access has IP 0.0.0.0/0 whitelisted (Allow access from anywhere). Retrying in 10s...');
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (retryTimer || isConnected) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connectDatabase();
  }, 10_000);
}

export async function disconnectDatabase(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected gracefully');
}

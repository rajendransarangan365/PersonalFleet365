import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // TLS is enabled by default for Atlas URIs
    });

    isConnected = true;
    logger.info('✅ MongoDB connected');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });
  } catch (err) {
    logger.error('Failed to connect to MongoDB', { error: err });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected gracefully');
}

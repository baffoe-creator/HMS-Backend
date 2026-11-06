import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Shared Redis connection for rate-limit counters.
 *
 * Do not set ioredis `commandTimeout`: it also affects handshake commands.
 * The limiter applies its own timeout around rate-limit operations.
 */
export const redisClient = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
});

redisClient.on('error', (err) => {
  console.error('Redis client error (rate limiting will fail open):', err.message);
});

export async function closeRedisClient(): Promise<void> {
  const status = redisClient.status;

  if (status === 'wait' || status === 'end') {
    return;
  }

  if (status === 'ready') {
    await redisClient.quit();
    return;
  }

  // Avoid waiting for quit() while the client is still connecting/reconnecting.
  redisClient.disconnect();
}
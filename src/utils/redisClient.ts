import Redis from 'ioredis';
import { env } from '../config/env';

export const redisClient = new Redis(env.redisUrl ?? 'redis://127.0.0.1:6379', {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return 200;
  },
});

redisClient.on('error', (err) => {
  console.warn('Redis warning:', (err as Error).message);
});

export async function closeRedisClient(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  if (redisClient.status === 'wait' || redisClient.status === 'end') return;
  await redisClient.quit();
}
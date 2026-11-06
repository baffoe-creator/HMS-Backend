afterAll(async () => {
  try {
    const { closeRedisClient } = await import('../src/utils/redisClient');
    await closeRedisClient();
  } catch {
    // this test file never loaded the Redis client
  }
}, 10_000);
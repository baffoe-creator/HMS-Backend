// Runs once per test file (Jest gives each file its own module registry).
// Closes the Redis connection that app.ts/rateLimiter.ts opens on import,
// so connections don't accumulate across the ~19 suites in one
// --runInBand process run. See PROGRESS_LOG.md Phase 7.2 debugging notes.
afterAll(async () => {
  try {
    const { closeRedisClient } = await import('../src/utils/redisClient');
    await closeRedisClient();
  } catch {
    // This test file never imported app.ts/redisClient at all - nothing to close.
  }
});
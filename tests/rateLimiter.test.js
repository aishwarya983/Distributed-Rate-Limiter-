// These tests run against a REAL local Redis because the core
// rate-limiting logic is implemented using Redis Lua scripts.

const express = require('express');
const request = require('supertest');
const redis = require('../src/redisClient');

const {
  tokenBucketLimiter,
  slidingWindowLimiter,
} = require('../src/middleware/rateLimiter');

function buildApp(middleware) {
  const app = express();

  app.get('/test', middleware, (req, res) => {
    res.json({ ok: true });
  });

  return app;
}

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.quit();
});

describe('tokenBucketLimiter', () => {
  test('allows requests up to capacity, then blocks', async () => {
    const app = buildApp(
      tokenBucketLimiter({
        capacity: 3,
        refillPerSec: 1,
      })
    );

    const results = [];

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/test');
      results.push(res.status);
    }

    expect(results.slice(0, 3)).toEqual([200, 200, 200]);
    expect(results.slice(3)).toEqual([429, 429]);
  });

  test('refills tokens over time', async () => {
    const app = buildApp(
      tokenBucketLimiter({
        capacity: 1,
        refillPerSec: 10,
      })
    );

    const first = await request(app).get('/test');
    expect(first.status).toBe(200);

    const immediate = await request(app).get('/test');
    expect(immediate.status).toBe(429);

    // 10 tokens/sec means approximately 100ms per token.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const afterWait = await request(app).get('/test');
    expect(afterWait.status).toBe(200);
  });

  test('rejects invalid token bucket configuration', () => {
    expect(() =>
      tokenBucketLimiter({
        capacity: 0,
        refillPerSec: 2,
      })
    ).toThrow('capacity must be a positive number');

    expect(() =>
      tokenBucketLimiter({
        capacity: 5,
        refillPerSec: -1,
      })
    ).toThrow('refillPerSec must be a positive number');
  });
});

describe('slidingWindowLimiter', () => {
  test('enforces max requests within the window', async () => {
    const app = buildApp(
      slidingWindowLimiter({
        windowMs: 5000,
        maxRequests: 3,
      })
    );

    const results = [];

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/test');
      results.push(res.status);
    }

    expect(results.slice(0, 3)).toEqual([200, 200, 200]);
    expect(results.slice(3)).toEqual([429, 429]);
  });

  test('old requests fall out of the window and free up capacity', async () => {
    const app = buildApp(
      slidingWindowLimiter({
        windowMs: 300,
        maxRequests: 1,
      })
    );

    const first = await request(app).get('/test');
    expect(first.status).toBe(200);

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 350));

    const afterWindow = await request(app).get('/test');
    expect(afterWindow.status).toBe(200);
  });

  test('rejects invalid sliding window configuration', () => {
    expect(() =>
      slidingWindowLimiter({
        windowMs: 0,
        maxRequests: 10,
      })
    ).toThrow('windowMs must be a positive number');

    expect(() =>
      slidingWindowLimiter({
        windowMs: 5000,
        maxRequests: 0,
      })
    ).toThrow('maxRequests must be a positive number');
  });
});
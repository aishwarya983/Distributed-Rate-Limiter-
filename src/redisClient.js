const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('ready', () => {
  console.log('[redis] ready');
});

redis.on('error', (err) => {
  console.error('[redis] error:', err.message);
});

module.exports = redis;
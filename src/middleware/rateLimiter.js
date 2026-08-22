const fs = require('fs');
const path = require('path');
const redis = require('../redisClient');
const stats = require('../stats');

const tokenBucketScript = fs.readFileSync(
  path.join(__dirname, 'tokenBucket.lua'),
  'utf8'
);

const slidingWindowScript = fs.readFileSync(
  path.join(__dirname, 'slidingWindow.lua'),
  'utf8'
);

function validatePositiveNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

/**
 * Identify the caller.
 * Uses API key when available and falls back to IP for anonymous traffic.
 */
function defaultKeyGenerator(req) {
  return req.headers['x-api-key'] || req.ip || 'anonymous';
}

/**
 * Token Bucket middleware factory.
 *
 * @param {number} capacity      max burst size
 * @param {number} refillPerSec  tokens added per second
 */
function tokenBucketLimiter({
  capacity = 10,
  refillPerSec = 2,
  keyGenerator = defaultKeyGenerator,
} = {}) {
  validatePositiveNumber(capacity, 'capacity');
  validatePositiveNumber(refillPerSec, 'refillPerSec');

  const refillRatePerMs = refillPerSec / 1000;

  return async function (req, res, next) {
    const clientId = keyGenerator(req);
    const redisKey = `rl:token:${clientId}`;
    const now = Date.now();

    try {
      const [allowed, tokensRemaining, retryAfterMs] = await redis.eval(
        tokenBucketScript,
        1,
        redisKey,
        capacity,
        refillRatePerMs,
        now,
        1
      );

      res.set('X-RateLimit-Limit', capacity);
      res.set('X-RateLimit-Remaining', Math.floor(tokensRemaining));
      res.set('X-RateLimit-Algorithm', 'token-bucket');

      if (allowed === 1) {
        stats.recordAllowed(clientId);
        return next();
      }

      stats.recordBlocked(clientId);
      res.set('Retry-After', Math.ceil(retryAfterMs / 1000));

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry in ${Math.ceil(
          retryAfterMs / 1000
        )}s.`,
        retryAfterMs,
      });
    } catch (err) {
      console.error('[rateLimiter] Redis error, failing open:', err.message);
      return next();
    }
  };
}

/**
 * Sliding Window middleware factory.
 *
 * @param {number} windowMs     size of the rolling window in ms
 * @param {number} maxRequests  max requests allowed per window
 */
function slidingWindowLimiter({
  windowMs = 60000,
  maxRequests = 20,
  keyGenerator = defaultKeyGenerator,
} = {}) {
  validatePositiveNumber(windowMs, 'windowMs');
  validatePositiveNumber(maxRequests, 'maxRequests');

  return async function (req, res, next) {
    const clientId = keyGenerator(req);
    const redisKey = `rl:window:${clientId}`;
    const now = Date.now();

    try {
      const [allowed, count, retryAfterMs] = await redis.eval(
        slidingWindowScript,
        1,
        redisKey,
        windowMs,
        maxRequests,
        now
      );

      res.set('X-RateLimit-Limit', maxRequests);
      res.set(
        'X-RateLimit-Remaining',
        Math.max(0, maxRequests - count)
      );
      res.set('X-RateLimit-Algorithm', 'sliding-window');

      if (allowed === 1) {
        stats.recordAllowed(clientId);
        return next();
      }

      stats.recordBlocked(clientId);
      res.set('Retry-After', Math.ceil(retryAfterMs / 1000));

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry in ${Math.ceil(
          retryAfterMs / 1000
        )}s.`,
        retryAfterMs,
      });
    } catch (err) {
      console.error('[rateLimiter] Redis error, failing open:', err.message);
      return next();
    }
  };
}

module.exports = {
  tokenBucketLimiter,
  slidingWindowLimiter,
};
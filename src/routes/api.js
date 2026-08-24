const express = require('express');
const {
  tokenBucketLimiter,
  slidingWindowLimiter,
} = require('../middleware/rateLimiter');
const stats = require('../stats');

const router = express.Router();

// Service information
router.get('/', (req, res) => {
  res.json({
    service: 'Distributed Rate Limiter',
    version: '1.0.0',
    algorithms: ['token-bucket', 'sliding-window'],
    endpoints: {
      tokenBucket: '/api/token-bucket',
      slidingWindow: '/api/sliding-window',
      stats: '/api/stats',
      resetStats: '/api/stats/reset',
    },
    timestamp: Date.now(),
  });
});

// Token Bucket endpoint.
// Allows short bursts and refills tokens over time.
router.get(
  '/token-bucket',
  tokenBucketLimiter({
    capacity: 10,
    refillPerSec: 2,
  }),
  (req, res) => {
    res.json({
      message: 'Request allowed (token bucket)',
      timestamp: Date.now(),
      client: req.headers['x-api-key'] || req.ip,
    });
  }
);

// Sliding Window endpoint.
// Allows a fixed number of requests within a rolling time window.
router.get(
  '/sliding-window',
  slidingWindowLimiter({
    windowMs: 10000,
    maxRequests: 8,
  }),
  (req, res) => {
    res.json({
      message: 'Request allowed (sliding window)',
      timestamp: Date.now(),
      client: req.headers['x-api-key'] || req.ip,
    });
  }
);

// Stats endpoint used by the dashboard for live numbers.
router.get('/stats', (req, res) => {
  res.json({
    ...stats.snapshot(),
    timestamp: Date.now(),
  });
});

// Reset dashboard statistics.
router.post('/stats/reset', (req, res) => {
  stats.reset();

  res.json({
    message: 'Stats reset',
    timestamp: Date.now(),
  });
});

module.exports = router;
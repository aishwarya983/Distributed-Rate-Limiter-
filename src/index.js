require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const redis = require('./redisClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the live dashboard as static files
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`rate-limiter-service listening on http://localhost:${PORT}`);
  console.log(`dashboard: http://localhost:${PORT}/index.html`);
});

// Gracefully close the server and Redis connection
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  server.close(async () => {
    await redis.quit();
    console.log('Redis connection closed.');
    process.exit(0);
  });
});
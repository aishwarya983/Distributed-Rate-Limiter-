# ⚡ Distributed Rate Limiter

A production-style **distributed API rate limiter** built with **Node.js, Express, Redis, and Lua**.

It implements **Token Bucket** and **Sliding Window Log** algorithms using atomic Redis Lua scripts, exposes them as reusable Express middleware, and includes a live dashboard for monitoring allowed and blocked requests.

> **Built to explore how real-world APIs control traffic, handle bursts, and maintain consistent rate limits across multiple server instances.**

---

## ✨ Features

* 🚦 **Token Bucket Rate Limiting**
* ⏱️ **Sliding Window Log Rate Limiting**
* 🔴 **Redis-backed shared state**
* ⚡ **Atomic Redis Lua scripts**
* 🌐 **Reusable Express middleware**
* 📊 **Live request monitoring dashboard**
* 🛡️ **Standard rate-limit response headers**
* 🔑 **API-key based client identification**
* 🌍 **IP fallback when API key is unavailable**
* 🧪 **Jest + Supertest integration tests**
* 🐳 **Docker support for local deployment**

---

## 🧠 How It Works

Every incoming request passes through the rate limiter before reaching the API.

```text
                    ┌─────────────────┐
                    │     Client      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Express Server  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Rate Limiter    │
                    │   Middleware    │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
          ┌───────────────┐     ┌────────────────┐
          │ Token Bucket  │     │ Sliding Window │
          └───────┬───────┘     └───────┬────────┘
                  │                     │
                  └──────────┬──────────┘
                             ▼
                    ┌─────────────────┐
                    │      Redis      │
                    │ Shared State +  │
                    │  Lua Execution  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
                 ALLOWED            BLOCKED
                    │                 │
                    ▼                 ▼
                 API Route          HTTP 429
```

Because Redis acts as the shared state store, multiple application instances can enforce the same rate limit.

---

## 🚦 Algorithms

### Token Bucket

Each client receives a bucket containing a limited number of tokens.

* Requests consume tokens.
* Tokens are replenished at a fixed rate.
* Bursts are allowed while tokens are available.
* Once the bucket is empty, requests are rejected until tokens are replenished.

**Example:**

```text
Bucket capacity: 10
Refill rate:     2 tokens/sec

Request → 🟢 token available → ALLOWED
Request → 🟢 token available → ALLOWED
Request → 🔴 no token        → BLOCKED
```

This approach is useful when an API should tolerate short bursts while maintaining a controlled average request rate.

---

### ⏱️ Sliding Window Log

The Sliding Window algorithm keeps track of recent request timestamps.

For a configured window:

```text
10 requests / 10 seconds
```

the limiter counts only requests that occurred within the latest 10 seconds.

```text
Past                         Now
│                              │
├── R ── R ─ R ─── R ── R ────┤
│                              │
└──────── 10 second window ────┘
```

When the request limit is reached, additional requests are rejected until older requests move outside the window.

---

## 🔴 Why Redis?

A local in-memory counter works for a single server, but becomes unreliable when an application is scaled horizontally.

```text
                    Load Balancer
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Server 1   Server 2   Server 3
              │          │          │
              └──────────┼──────────┘
                         ▼
                       Redis
```

All application instances use the same Redis state.

This means a client cannot bypass the rate limit simply because their requests are routed to different servers.

---

## ⚡ Why Lua Scripts?

The rate-limit operation involves multiple steps:

```text
Read state
   ↓
Check limit
   ↓
Update state
   ↓
Return result
```

If these operations were performed separately from Node.js, concurrent requests could create race conditions.

Instead, the project executes the complete operation inside Redis using **Lua scripts**.

```text
Node.js
   │
   │ EVAL
   ▼
Redis Lua Script
   │
   ├── Read state
   ├── Check limit
   ├── Update state
   └── Return result
```

This keeps the rate-limit decision and state update **atomic**.

---

## 📊 Live Dashboard

The project includes a lightweight dashboard for testing and monitoring the limiter.

You can:

* Send individual requests
* Generate burst traffic
* Test Token Bucket
* Test Sliding Window
* View allowed requests
* View blocked requests
* Monitor the block rate
* Inspect recent request activity

```text
Token Bucket        Sliding Window
     │                    │
     ▼                    ▼
  1 Request           1 Request
  Burst 15x           Burst 15x
```

---

## 🛠️ Tech Stack

| Technology     | Purpose                      |
| -------------- | ---------------------------- |
| **Node.js**    | Backend runtime              |
| **Express.js** | HTTP server & middleware     |
| **Redis**      | Distributed rate-limit state |
| **ioredis**    | Node.js Redis client         |
| **Lua**        | Atomic Redis operations      |
| **Jest**       | Testing                      |
| **Supertest**  | API testing                  |
| **Docker**     | Containerized setup          |

---

## 📁 Project Structure

```text
rate-limiter-service/
│
├── src/
│   ├── index.js
│   ├── redisClient.js
│   ├── stats.js
│   │
│   ├── middleware/
│   │   ├── rateLimiter.js
│   │   ├── tokenBucket.lua
│   │   └── slidingWindow.lua
│   │
│   └── routes/
│       └── api.js
│
├── public/
│   ├── index.html
│   └── app.js
│
├── tests/
│   └── rateLimiter.test.js
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have:

* Node.js
* npm
* Redis

### 1. Clone the repository

```bash
git clone https://github.com/aishwarya983/Distributed-Rate-Limiter-.git

cd Distributed-Rate-Limiter-
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file based on the example:

```bash
cp .env.example .env
```

Make sure Redis is running locally on:

```text
127.0.0.1:6379
```

### 4. Start the server

```bash
npm start
```

For development with automatic restarts:

```bash
npm run dev
```

### 5. Open the dashboard

```text
http://localhost:3000
```

---

## 🧪 Running Tests

The project uses **Jest** and **Supertest**.

```bash
npm test
```

The rate-limiter tests use Redis because the actual limiting logic is executed through Redis Lua scripts.

---

## 📈 Example Rate-Limit Flow

Suppose an endpoint allows:

```text
10 requests / second
```

A client sends 15 requests quickly:

```text
Request 1   → ✅ Allowed
Request 2   → ✅ Allowed
Request 3   → ✅ Allowed
...
Request 10  → ✅ Allowed
Request 11  → ❌ Blocked
Request 12  → ❌ Blocked
...
Request 15  → ❌ Blocked
```

The API responds with:

```text
HTTP 429 Too Many Requests
```

along with rate-limit information such as:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
Retry-After
```

---

## 🎯 Design Decisions

### Shared Redis State

Redis provides a centralized state store so rate limits remain consistent across multiple application instances.

### Atomic Operations

Lua scripts keep the read → check → update operation atomic.

### Client Identification

Clients can be identified using:

```text
X-API-Key
```

with the client's IP address used as a fallback.

### Expiring Redis Keys

Rate-limit state is automatically expired so inactive clients do not remain in Redis indefinitely.

### Fail-Open Behavior

If Redis becomes unavailable, the middleware allows requests through rather than taking the entire API offline.

This is a deliberate availability vs. strict-enforcement tradeoff.

---

## 🔮 Possible Improvements

Some future extensions could include:

* 📊 Prometheus + Grafana metrics
* 🌐 Distributed load testing across multiple Node.js instances
* ⚖️ Nginx load balancing
* 📈 Sliding Window Counter algorithm
* 🔐 Authentication-based rate limiting
* 🗄️ Redis Cluster support
* 🚨 Configurable limits per API route
* 📡 WebSocket-based live dashboard updates

---

## 💡 What This Project Demonstrates

This project was built to understand practical backend and distributed-system concepts including:

* API rate limiting
* Redis
* Distributed state management
* Middleware architecture
* Atomic operations
* Redis Lua scripting
* Concurrency and race conditions
* HTTP status codes
* API design
* Backend testing
* Horizontal scaling concepts

---

## 👩‍💻 Author

**Aishwarya Desai**

Computer Science Student | Aspiring Software Developer

[GitHub](https://github.com/aishwarya983)

---

⭐ If you find this project useful, consider giving it a star.

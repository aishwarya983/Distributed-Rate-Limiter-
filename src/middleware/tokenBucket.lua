-- Token Bucket rate limiter
--
-- KEYS[1] = bucket key
-- ARGV[1] = bucket capacity
-- ARGV[2] = refill rate per millisecond
-- ARGV[3] = current timestamp in milliseconds
-- ARGV[4] = tokens requested
--
-- Returns:
-- { allowed, tokens_remaining, retry_after_ms }

local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'timestamp')

local tokens = tonumber(data[1])
local timestamp = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    timestamp = now
end

local elapsed = math.max(0, now - timestamp)
local refilled = elapsed * refill_rate

tokens = math.min(capacity, tokens + refilled)
timestamp = now

local allowed = 0
local retry_after_ms = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local missing = requested - tokens

    if refill_rate > 0 then
        retry_after_ms = math.ceil(missing / refill_rate)
    end
end

redis.call(
    'HSET',
    key,
    'tokens',
    tokens,
    'timestamp',
    timestamp
)

-- Remove idle buckets automatically.
redis.call('EXPIRE', key, 3600)

return {
    allowed,
    tokens,
    retry_after_ms
}
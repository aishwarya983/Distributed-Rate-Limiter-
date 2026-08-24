-- Sliding Window Log rate limiter
--
-- KEYS[1] = sorted set key
-- ARGV[1] = window size in milliseconds
-- ARGV[2] = maximum requests allowed
-- ARGV[3] = current timestamp in milliseconds
--
-- Returns:
-- { allowed, request_count, retry_after_ms }

local key = KEYS[1]

local window_ms = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local window_start = now - window_ms

-- Remove requests that are outside the current window.
redis.call(
    'ZREMRANGEBYSCORE',
    key,
    '-inf',
    window_start
)

-- Count requests that are still inside the window.
local count = redis.call('ZCARD', key)

local allowed = 0
local retry_after_ms = 0

if count < max_requests then
    -- Use the timestamp plus a unique suffix as the sorted-set member.
    local member = tostring(now) .. '-' .. tostring(redis.call('INCR', key .. ':seq'))

    redis.call(
        'ZADD',
        key,
        now,
        member
    )

    count = count + 1
    allowed = 1
else
    -- Find the oldest request so we know when capacity becomes available.
    local oldest = redis.call(
        'ZRANGE',
        key,
        0,
        0,
        'WITHSCORES'
    )

    if oldest[2] ~= nil then
        local oldest_timestamp = tonumber(oldest[2])
        retry_after_ms = math.max(
            0,
            (oldest_timestamp + window_ms) - now
        )
    end
end

-- Keep inactive rate-limit data from remaining forever.
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 1)
redis.call('EXPIRE', key .. ':seq', math.ceil(window_ms / 1000) + 1)

return {
    allowed,
    count,
    retry_after_ms
}
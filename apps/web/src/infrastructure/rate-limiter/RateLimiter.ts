import Redis from "ioredis"

let client: Redis | null = null

function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    })
  }
  return client
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter?: number
}

// Sliding window via sorted set. Atomically removes stale entries, counts,
// and conditionally inserts — all in one Lua round-trip.
const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local win_start = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local win_secs = tonumber(ARGV[4])
local member = ARGV[5]
redis.call('ZREMRANGEBYSCORE', key, '-inf', win_start)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = math.ceil((tonumber(oldest[2] or now) + win_secs * 1000 - now) / 1000)
  return {0, 0, math.max(1, retry)}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, win_secs)
return {1, limit - count - 1, 0}
`

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const redis = getRedis()
    const now = Date.now()
    const winStart = now - windowSeconds * 1000

    const result = (await redis.eval(
      SCRIPT,
      1,
      `rl:${key}`,
      String(now),
      String(winStart),
      String(limit),
      String(windowSeconds),
      `${now}:${Math.random()}`,
    )) as [number, number, number]

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfter: result[2] > 0 ? result[2] : undefined,
    }
  } catch {
    // Fail open if Redis is unavailable — never block legitimate traffic.
    return { allowed: true, remaining: 0 }
  }
}

export function rateLimitResponse(retryAfter?: number): Response {
  return new Response(JSON.stringify({ error: "TOO_MANY_REQUESTS" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  })
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return (forwarded.split(",")[0] ?? forwarded).trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

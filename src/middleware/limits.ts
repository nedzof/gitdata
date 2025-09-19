/**
 * Rate limits per route using a simple token bucket per (ip, routeKey).
 * Configure via RATE_LIMITS_JSON, e.g.:
 *   {"submit":10,"bundle":30,"ready":60,"price":120,"data":60,"pay":10}
 * Units: requests per minute.
 */

type LimitsConfig = Record<string, number>;

function getLimits(): LimitsConfig {
  try {
    const raw = process.env.RATE_LIMITS_JSON;
    if (raw) return JSON.parse(raw);
  } catch {}
  // Defaults (dev-friendly)
  return { submit: 10, bundle: 30, ready: 60, price: 120, data: 60, pay: 10 };
}

type Bucket = { tokens: number; lastRefillMs: number; capacity: number; ratePerMs: number };
const buckets = new Map<string, Bucket>();

function takeToken(key: string, capacity: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  const ratePerMs = capacity / 60000; // capacity per minute
  if (!b) {
    b = { tokens: capacity, lastRefillMs: now, capacity, ratePerMs };
    buckets.set(key, b);
  }
  // Refill
  const elapsed = now - b.lastRefillMs;
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.ratePerMs);
    b.lastRefillMs = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

/** Middleware factory for a given logical route key (e.g., 'submit', 'bundle', 'ready', 'price', 'data', 'pay') */
export function rateLimit(routeKey: string) {
  const limits = getLimits();
  const capacity = Math.max(1, Number(limits[routeKey] || 60));

  return function (req: any, res: any, next: any) {
    try {
      let ip = req.ip || req.socket?.remoteAddress || 'unknown';
      if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].toString().split(',')[0].trim();
      }
      ip = ip.toString();
      const key = `${routeKey}:${ip}`;
      if (!takeToken(key, capacity)) {
        res.setHeader('retry-after', '60');
        return res.status(429).json({ error: 'rate-limited', hint: `limit=${capacity}/min` });
      }
      next();
    } catch (e: any) {
      return res.status(500).json({ error: 'rate-limit-error', message: String(e?.message || e) });
    }
  };
}
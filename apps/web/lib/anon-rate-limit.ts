// IP-based rate limit for anonymous /start flow — 2 goal generations per IP per 24h
const ANON_LIMIT = 2;
const ANON_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  timestamps: number[];
}

const ipBuckets = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets) {
    bucket.timestamps = bucket.timestamps.filter(t => now - t < ANON_WINDOW_MS);
    if (bucket.timestamps.length === 0) ipBuckets.delete(key);
  }
}, 5 * 60 * 1000);

export function checkAnonRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    ipBuckets.set(ip, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter(t => now - t < ANON_WINDOW_MS);
  if (bucket.timestamps.length >= ANON_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  bucket.timestamps.push(now);
  return { allowed: true, remaining: ANON_LIMIT - bucket.timestamps.length };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// In-memory rate limiter — 50 AI calls / 24 h / user
const LIMIT = 50;
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter(t => now - t < WINDOW_MS);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(userId, bucket);
  }

  // Prune expired
  bucket.timestamps = bucket.timestamps.filter(t => now - t < WINDOW_MS);

  if (bucket.timestamps.length >= LIMIT) {
    const oldest = bucket.timestamps[0];
    return { allowed: false, remaining: 0, resetAt: new Date(oldest + WINDOW_MS) };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: LIMIT - bucket.timestamps.length, resetAt: new Date(now + WINDOW_MS) };
}

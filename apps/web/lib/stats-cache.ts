const statsCache = new Map<string, { data: unknown; expiresAt: number }>();

export function getCachedStats(userId: string) {
  const cached = statsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  return null;
}

export function setCachedStats(userId: string, data: unknown) {
  statsCache.set(userId, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export function clearStatsCache(userId: string) {
  statsCache.delete(userId);
}

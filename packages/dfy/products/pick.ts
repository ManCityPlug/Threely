import type { ProductNiche, Product } from "./types";
import { PRODUCTS } from "./library";

export interface PickProductsInput {
  niches?: ProductNiche[];  // filter to one or more niches
  count?: number;            // default 3
  seed?: string;             // optional — deterministic shuffle for same user
  exclude_ids?: string[];    // don't return these (already shown to user)
}

// FNV-1a 32-bit hash
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Linear congruential generator seeded by FNV-1a hash
function seededRandom(seed: string): () => number {
  let state = fnv1a(seed);
  return function (): number {
    // LCG parameters from Numerical Recipes
    state = Math.imul(1664525, state) + 1013904223;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickProducts(input?: PickProductsInput): Product[] {
  const {
    niches,
    count = 3,
    seed,
    exclude_ids = [],
  } = input ?? {};

  const clampedCount = Math.max(1, Math.min(count, PRODUCTS.length));

  const excludeSet = new Set(exclude_ids);

  // Apply niche filter, then exclusion filter
  let pool = niches && niches.length > 0
    ? PRODUCTS.filter((p) => p.niches.some((n) => niches.includes(n)))
    : PRODUCTS.slice();

  pool = pool.filter((p) => !excludeSet.has(p.id));

  // If filtering leaves us with nothing, fall back to all products (minus exclusions)
  if (pool.length === 0) {
    pool = PRODUCTS.filter((p) => !excludeSet.has(p.id));
  }

  // If still empty (all products excluded), use full library
  if (pool.length === 0) {
    pool = PRODUCTS.slice();
  }

  const rng: () => number = seed ? seededRandom(seed) : () => Math.random();
  const shuffled = shuffle(pool, rng);

  // Deduplicate by id (shouldn't be needed given PRODUCTS has unique ids, but be safe)
  const seen = new Set<string>();
  const deduped: Product[] = [];
  for (const p of shuffled) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      deduped.push(p);
    }
    if (deduped.length >= clampedCount) break;
  }

  return deduped;
}

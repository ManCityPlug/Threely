import { PATTERNS } from "./patterns";
import { MODIFIERS } from "./modifiers";

export interface GenerateNamesInput {
  keyword: string;
  niche?: string;
  count?: number;
}

// Basic blocklist — keep short, just the obvious ones
const BLOCKLIST = [
  "sex",
  "porn",
  "fuck",
  "shit",
  "nigger",
  "nigga",
  "faggot",
  "cunt",
  "whore",
  "slut",
  "bitch",
];

// Patterns that produce ugly or inconsistent output — excluded entirely.
// The brandable single-word ones (Studio, Co, etc.) move to BRANDABLE_PATTERNS instead.
const SKIP_PATTERNS = new Set([
  "{Keyword}r",
  "{Keyword}ify",
  "{keyword}o",
  "{Keyword}ly",
  "{Keyword}ery",
  "{Keyword}ique",
  "{Keyword}able",
  "{Keyword}ful",
  "{Keyword}ish",
  "{Keyword}est",
  "{Keyword}wise",
  "{Keyword}craft",
  "{Keyword}forge",
  "{Keyword}ling",
  "{keyword}ly",
  "{keyword}app",
  "{keyword}hub",
  "{keyword}base",
  // All-lowercase single-word patterns — look unfinished as a brand name
  "{keyword}",
  "{keyword} co",
  "{keyword} co.",
  "{keyword} brand",
  "{keyword} only",
  "{keyword} pure",
  // Mixed-case glued that look odd (Hello coffee, not Hello Coffee — but template uses lowercase)
  "Hello {keyword}",
  // Camel-case-glued patterns that work for tech but look odd for most niches
  "Get{Keyword}",
  "Try{Keyword}",
  "Use{Keyword}",
  "Meet{Keyword}",
  // These use {keyword} (lowercase) inside phrases — replaced by {Keyword} variants above
  "{keyword} & Co",
  "{keyword} & Co.",
  "{keyword} Co",
  "{keyword} Co.",
  "{keyword}.",
  "{keyword}.io",
]);

// These single-word compound patterns are moved to the brandable pool (not skipped)
const BRANDABLE_PATTERNS = new Set([
  "{Keyword}Studio",
  "{Keyword}Co",
  "{Keyword}Brand",
  "{Keyword}Only",
  "{Keyword}Pure",
  "{Keyword}ista",
]);

function toTitleCase(s: string): string {
  // Handle multi-word keywords: "lawn care" -> "Lawn Care"
  return s
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// FNV-1a 32-bit hash — deterministic, no external deps
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Seeded LCG pseudo-random — gives different results per keyword+date combo
function makePrng(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderPattern(pattern: string, lower: string, titled: string): string {
  // For single-word compound patterns (no space in template outside the placeholder),
  // strip spaces from the keyword so "Lawn Care" -> "LawnCare" in "LawnCareCo"
  const compactLower = lower.replace(/\s+/g, "");
  const compactTitled = titled.replace(/\s+/g, "");
  // Detect if pattern is a single-word compound (no space except inside placeholder)
  const withoutPlaceholder = pattern.replace(/\{[Kk]eyword\}/g, "");
  const isSingleWordCompound = !withoutPlaceholder.includes(" ");
  if (isSingleWordCompound) {
    return pattern
      .replace(/\{keyword\}/g, compactLower)
      .replace(/\{Keyword\}/g, compactTitled);
  }
  return pattern
    .replace(/\{keyword\}/g, lower)
    .replace(/\{Keyword\}/g, titled);
}

function isOffensive(name: string): boolean {
  const n = name.toLowerCase();
  return BLOCKLIST.some((bad) => n.includes(bad));
}

export function generateBusinessNames(input: GenerateNamesInput): string[] {
  const raw = (input.keyword ?? "").trim();
  if (!raw) return [];

  const count = input.count ?? 5;
  const lower = raw.toLowerCase();
  const titled = toTitleCase(raw);

  // Seed is hash of keyword + current date (YYYYMMDD) so same keyword produces
  // different results on different days but is stable within a single day's call
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const seed = hashString(lower + datePart);
  const rng = makePrng(seed);

  // Split patterns: readable two-word patterns vs single-word brandable ones
  const readablePatterns = PATTERNS.filter((p) => !SKIP_PATTERNS.has(p) && !BRANDABLE_PATTERNS.has(p));
  const brandablePatterns = PATTERNS.filter((p) => BRANDABLE_PATTERNS.has(p));

  const shuffledReadable = shuffleArray(readablePatterns, rng);
  const shuffledBrandable = shuffleArray(brandablePatterns, rng);

  // ~20% invented/brandable, rest from readable patterns
  const inventedCount = Math.max(count >= 5 ? 1 : 0, Math.round(count * 0.2));
  const patternCount = count - inventedCount;

  const names: string[] = [];
  const seen = new Set<string>();

  // Fill primary slots from readable patterns
  for (const pattern of shuffledReadable) {
    if (names.length >= patternCount) break;
    const name = renderPattern(pattern, lower, titled);
    const normalised = name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(normalised) && !isOffensive(name)) {
      seen.add(normalised);
      names.push(name);
    }
  }

  // Fill brandable/invented slots from suffix pool then suffix modifiers
  const brandableCandidates: string[] = [];
  for (const pattern of shuffledBrandable) {
    const name = renderPattern(pattern, lower, titled);
    brandableCandidates.push(name);
  }
  // Add modifier-suffix invented words — only clean-sounding endings
  // "ify" works for most nouns (yogaify, petify), "ista" for lifestyle brands
  // Skip if keyword already ends with that suffix or the suffix's first letter
  const compactTitled = titled.replace(/\s+/g, "");
  const CLEAN_SUFFIXES = ["ify", "ista"];
  const shuffledSuffixes = shuffleArray(CLEAN_SUFFIXES, rng);
  for (const suf of shuffledSuffixes) {
    if (!lower.replace(/\s+/g, "").endsWith(suf)) {
      brandableCandidates.push(`${compactTitled}${suf}`);
    }
  }

  for (const name of brandableCandidates) {
    if (names.length >= count) break;
    const normalised = name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(normalised) && !isOffensive(name)) {
      seen.add(normalised);
      names.push(name);
    }
  }

  // Safety fallback: if still short, pull more readable
  for (const pattern of shuffledReadable) {
    if (names.length >= count) break;
    const name = renderPattern(pattern, lower, titled);
    const normalised = name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(normalised) && !isOffensive(name)) {
      seen.add(normalised);
      names.push(name);
    }
  }

  return names.slice(0, count);
}

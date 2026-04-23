import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { pickProducts } from "@threely/dfy/products";
import type { ProductNiche } from "@threely/dfy/products";

const VALID_NICHES: ProductNiche[] = [
  "fitness",
  "beauty",
  "tech_accessories",
  "home_decor",
  "pet",
  "kids",
  "eco",
  "wellness",
];

// POST /api/dfy/products
// Body: { niches?: string[], count?: number, exclude_ids?: string[] }
// Returns: { products: Product[] }
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty or malformed body — treat as empty input
  }

  const { niches: rawNiches, count: rawCount, exclude_ids: rawExclude } = body as {
    niches?: unknown;
    count?: unknown;
    exclude_ids?: unknown;
  };

  // Validate niches
  let niches: ProductNiche[] | undefined;
  if (rawNiches !== undefined) {
    if (!Array.isArray(rawNiches)) {
      return NextResponse.json(
        { error: "niches must be an array" },
        { status: 400 }
      );
    }
    const invalidNiche = (rawNiches as unknown[]).find(
      (n) => typeof n !== "string" || !VALID_NICHES.includes(n as ProductNiche)
    );
    if (invalidNiche !== undefined) {
      return NextResponse.json(
        {
          error: `Invalid niche: "${String(invalidNiche)}". Valid values: ${VALID_NICHES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    niches = rawNiches as ProductNiche[];
  }

  // Validate count (1-10)
  let count = 3;
  if (rawCount !== undefined) {
    const parsed = Number(rawCount);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return NextResponse.json(
        { error: "count must be an integer between 1 and 10" },
        { status: 400 }
      );
    }
    count = parsed;
  }

  // Validate exclude_ids
  let exclude_ids: string[] | undefined;
  if (rawExclude !== undefined) {
    if (!Array.isArray(rawExclude) || (rawExclude as unknown[]).some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "exclude_ids must be an array of strings" },
        { status: 400 }
      );
    }
    exclude_ids = rawExclude as string[];
  }

  // Seed = userId + today's date (YYYY-MM-DD) — same user gets same order per day
  const today = new Date().toISOString().split("T")[0];
  const seed = `${user.id}:${today}`;

  try {
    const products = pickProducts({ niches, count, seed, exclude_ids });
    return NextResponse.json({ products }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/dfy/products]", msg, e);
    return NextResponse.json({ error: "Failed to pick products" }, { status: 500 });
  }
}

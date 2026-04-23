import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { generateBusinessNames } from "@threely/dfy/names";

// POST /api/dfy/names
// Body: { keyword: string, niche?: string, count?: number }
// Returns: { names: string[] }
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { keyword, niche, count } = body as {
    keyword?: string;
    niche?: string;
    count?: number;
  };

  if (!keyword || typeof keyword !== "string") {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  const trimmed = keyword.trim();

  if (trimmed.length === 0) {
    return NextResponse.json({ error: "keyword must not be empty" }, { status: 400 });
  }

  if (trimmed.length > 30) {
    return NextResponse.json({ error: "keyword must be 30 characters or fewer" }, { status: 400 });
  }

  // Only letters, numbers, spaces, and hyphens
  if (!/^[a-zA-Z0-9 -]+$/.test(trimmed)) {
    return NextResponse.json(
      { error: "keyword may only contain letters, numbers, spaces, and hyphens" },
      { status: 400 }
    );
  }

  const resolvedCount = typeof count === "number" && count > 0 && count <= 20 ? count : 5;

  try {
    const names = generateBusinessNames({ keyword: trimmed, niche, count: resolvedCount });
    return NextResponse.json({ names }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/dfy/names]", msg, e);
    return NextResponse.json({ error: "Failed to generate names" }, { status: 500 });
  }
}

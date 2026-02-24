import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { parseGoal } from "@/lib/claude";

// POST /api/goals/parse
// Body: { rawInput: string }
// Calls Claude to parse free-text goal input into structured data.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { rawInput } = body as { rawInput?: string };

  if (!rawInput?.trim()) {
    return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const parsed = await parseGoal(rawInput.trim());
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/goals/parse]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

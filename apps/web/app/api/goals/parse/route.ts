import { NextRequest, NextResponse } from "next/server";
import { getAnyUserFromRequest } from "@/lib/supabase";
import { parseGoal } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { checkAnonRateLimit, getClientIp } from "@/lib/anon-rate-limit";

// Allow up to 30 seconds for Claude API calls
export const maxDuration = 30;

// POST /api/goals/parse
// Body: { rawInput: string }
// Calls Claude to parse free-text goal input into structured data.
export async function POST(request: NextRequest) {
  const user = await getAnyUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Anonymous user — goal cap only
  if (user.isAnonymous) {
    const anonGoalCount = await prisma.goal.count({ where: { userId: user.id } });
    if (anonGoalCount >= 2) {
      return NextResponse.json({ error: "Sign up to create more goals" }, { status: 403 });
    }
  } else {
    // Real user — pro gate, allow first goal free
    const goalCount = await prisma.goal.count({ where: { userId: user.id, isActive: true } });
    if (goalCount > 0) {
      const access = await getUserAccess(user.id);
      if (!access.hasPro) {
        return NextResponse.json({
          error: "pro_required",
          message: "Subscribe to keep your momentum going",
          trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
        }, { status: 403 });
      }
    }
  }

  const body = await request.json().catch(() => ({}));
  const { rawInput } = body as { rawInput?: string };

  if (!rawInput?.trim()) {
    return NextResponse.json({ error: "rawInput is required" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  try {
    const parsed = await parseGoal(rawInput.trim(), user.id);
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("Request timed out");
    console.error("[/api/goals/parse]", msg);
    if (isTimeout) {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to parse goal" }, { status: 500 });
  }
}

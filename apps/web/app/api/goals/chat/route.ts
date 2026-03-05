import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { goalChat, type GoalChatMessage } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";

// Allow up to 30 seconds for Claude API calls (cold starts + response generation)
export const maxDuration = 30;

// POST /api/goals/chat
// Body: { messages: Array<{ role: "user" | "assistant", content: string }>, onboarding?: boolean }
// Returns the next question (or final goal_text) from the guided chat.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { messages, onboarding } = body as { messages?: GoalChatMessage[]; onboarding?: boolean };

  // Pro gate — skip during onboarding or if user has no goals yet (first goal free)
  if (!onboarding) {
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

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  try {
    const result = await goalChat(messages, user.id);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("Request timed out");
    console.error("[/api/goals/chat]", msg, "| messages count:", messages.length);
    if (isTimeout) {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { goalChat, type GoalChatMessage } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";

// POST /api/goals/chat
// Body: { messages: Array<{ role: "user" | "assistant", content: string }> }
// Returns the next question (or final goal_text) from the guided chat.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pro gate
  const access = await getUserAccess(user.id);
  if (!access.hasPro) {
    return NextResponse.json({
      error: "pro_required",
      message: "Subscribe to keep your momentum going",
      trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
    }, { status: 403 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { messages } = body as { messages?: GoalChatMessage[] };

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await goalChat(messages);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/goals/chat]", msg, "| messages count:", messages.length);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

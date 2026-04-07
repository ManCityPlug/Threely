import { NextRequest, NextResponse } from "next/server";
import { getAnyUserFromRequest } from "@/lib/supabase";
import { goalChat, type GoalChatMessage } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
import { checkAnonRateLimit, getClientIp } from "@/lib/anon-rate-limit";

// Allow up to 30 seconds for Claude API calls (cold starts + response generation)
export const maxDuration = 30;

// POST /api/goals/chat
// Body: { messages: Array<{ role: "user" | "assistant", content: string }>, onboarding?: boolean }
// Returns the next question (or final goal_text) from the guided chat.
export async function POST(request: NextRequest) {
  const user = await getAnyUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { messages, onboarding } = body as { messages?: GoalChatMessage[]; onboarding?: boolean };

  if (user.isAnonymous) {
    const ip = getClientIp(request);
    const { allowed: ipAllowed } = checkAnonRateLimit(ip);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Too many requests from this IP. Try again tomorrow or sign up." }, { status: 429 });
    }
  } else if (!onboarding) {
    // Pro gate for real users — skip during onboarding or if user has no goals yet (first goal free)
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

  if (messages.length > 50) {
    return NextResponse.json({ error: "Too many messages" }, { status: 400 });
  }

  const validRoles = new Set(["user", "assistant"]);
  for (const msg of messages) {
    if (!msg || typeof msg.content !== "string" || !validRoles.has(msg.role)) {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
    }
  }

  const totalContentLength = messages.reduce((sum: number, m: GoalChatMessage) => sum + (m.content?.length ?? 0), 0);
  if (totalContentLength > 50000) {
    return NextResponse.json({ error: "Message content too large" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  // Check if user already has a real display name (skip name question if so)
  // Apple/Google sign-in provides real names — use those. Only filter out email-derived names.
  let userName: string | null = null;
  try {
    const { data } = await (await import("@/lib/supabase")).supabaseAdmin.auth.admin.getUserById(user.id);
    const name = data?.user?.user_metadata?.display_name || data?.user?.user_metadata?.full_name || null;
    // Only use it if it looks like a real name (not an email prefix like "erik.mitev37")
    if (name && !name.includes("@") && !name.includes(".") && !/^\d+$/.test(name)) {
      userName = name;
    }
  } catch { /* ignore */ }

  try {
    const result = await goalChat(messages, user.id, userName);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("Request timed out");
    console.error("[/api/goals/chat]", msg, "| messages count:", messages.length);
    if (isTimeout) {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to process chat request" }, { status: 500 });
  }
}

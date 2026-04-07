import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/pause ─────────────────────────────────────────────
// Body: { days?: number } (default 30)
// Pauses Stripe collection until resumes_at, marks any invoices uncollectible.
// Updates User.pauseEndsAt and User.lastSaveOfferAt.

const DEFAULT_PAUSE_DAYS = 30;
const MIN_PAUSE_DAYS = 1;
const MAX_PAUSE_DAYS = 90;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  // Parse body
  let body: { days?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const requestedDays = Number.isFinite(body.days) ? Math.floor(body.days as number) : DEFAULT_PAUSE_DAYS;
  const days = Math.max(MIN_PAUSE_DAYS, Math.min(MAX_PAUSE_DAYS, requestedDays));

  const resumesAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const resumesAtUnix = Math.floor(resumesAt.getTime() / 1000);

  const stripeClient = getStripe();

  try {
    await stripeClient.subscriptions.update(dbUser.subscriptionId, {
      pause_collection: {
        behavior: "mark_uncollectible",
        resumes_at: resumesAtUnix,
      },
    });

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pauseEndsAt: resumesAt,
        lastSaveOfferAt: now,
      },
    });

    return NextResponse.json({
      paused: true,
      pauseEndsAt: resumesAt.toISOString(),
      days,
    });
  } catch (err) {
    console.error("Failed to pause subscription:", err);
    return NextResponse.json({ error: "Failed to pause subscription" }, { status: 500 });
  }
}

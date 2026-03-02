import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/reactivate — undo pending cancellation ───────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const stripeClient = getStripe();

  try {
    const sub = await stripeClient.subscriptions.update(dbUser.subscriptionId, {
      cancel_at_period_end: false,
    });

    return NextResponse.json({
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
    });
  } catch (err) {
    console.error("Failed to reactivate subscription:", err);
    return NextResponse.json({ error: "Failed to reactivate subscription" }, { status: 500 });
  }
}

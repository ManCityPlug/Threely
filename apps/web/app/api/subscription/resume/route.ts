import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/resume ────────────────────────────────────────────
// Clears the Stripe pause_collection and the local pauseEndsAt flag.

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
      pause_collection: null,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { pauseEndsAt: null },
    });

    return NextResponse.json({
      resumed: true,
      status: sub.status,
    });
  } catch (err) {
    console.error("Failed to resume subscription:", err);
    return NextResponse.json({ error: "Failed to resume subscription" }, { status: 500 });
  }
}

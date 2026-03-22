import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── GET /api/start/trial-check — check if user is eligible for free trial ───

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json({ eligible: true }); // no card yet, assume eligible
    }

    // Already claimed trial on this account?
    if (dbUser.trialClaimedAt) {
      return NextResponse.json({ eligible: false });
    }

    // Check card fingerprint
    const stripeClient = getStripe();
    const paymentMethods = await stripeClient.paymentMethods.list({
      customer: dbUser.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (!paymentMethods.data.length) {
      return NextResponse.json({ eligible: true }); // no card attached yet
    }

    const fingerprint = paymentMethods.data[0].card?.fingerprint;
    if (fingerprint) {
      const existing = await prisma.trialCardFingerprint.findUnique({
        where: { fingerprint },
      });
      if (existing) {
        return NextResponse.json({ eligible: false });
      }
    }

    return NextResponse.json({ eligible: true });
  } catch (err: unknown) {
    console.error("[start/trial-check] Error:", err);
    return NextResponse.json({ error: "Unable to check trial eligibility. Please try again." }, { status: 500 });
  }
}

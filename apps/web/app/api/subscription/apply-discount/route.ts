import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/apply-discount ────────────────────────────────────
// Body:
//   {
//     percent_off: number,                   // 1..100
//     duration: 'once' | 'repeating',
//     duration_in_months?: number,           // required when duration='repeating'
//   }
// Creates a one-time Stripe coupon and applies it to the customer.
// Updates User.lastSaveOfferAt to throttle future save offers.

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.stripeCustomerId || !dbUser?.subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  // Parse body
  let body: { percent_off?: number; duration?: string; duration_in_months?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const percentOff = Number(body.percent_off);
  const duration = body.duration === "repeating" ? "repeating" : "once";
  const durationInMonths = body.duration_in_months != null ? Number(body.duration_in_months) : undefined;

  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    return NextResponse.json(
      { error: "percent_off must be between 1 and 100" },
      { status: 400 }
    );
  }

  if (duration === "repeating" && (!durationInMonths || durationInMonths < 1)) {
    return NextResponse.json(
      { error: "duration_in_months is required for repeating discounts" },
      { status: 400 }
    );
  }

  const stripeClient = getStripe();

  try {
    const coupon = await stripeClient.coupons.create({
      percent_off: percentOff,
      duration,
      ...(duration === "repeating" ? { duration_in_months: durationInMonths } : {}),
      metadata: { userId: user.id, source: "save_offer" },
    });

    await stripeClient.customers.update(dbUser.stripeCustomerId, {
      coupon: coupon.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastSaveOfferAt: new Date() },
    });

    return NextResponse.json({
      applied: true,
      coupon: {
        id: coupon.id,
        percentOff: coupon.percent_off,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months,
      },
    });
  } catch (err) {
    console.error("Failed to apply discount:", err);
    return NextResponse.json({ error: "Failed to apply discount" }, { status: 500 });
  }
}

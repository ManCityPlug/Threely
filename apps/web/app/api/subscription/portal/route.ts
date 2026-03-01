import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

// ─── POST /api/subscription/portal — create Stripe Billing Portal session ────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const stripeClient = getStripe();
  let customerId = dbUser?.stripeCustomerId ?? null;

  // If no customer ID in DB, try to find by email in Stripe
  if (!customerId && user.email) {
    const customers = await stripeClient.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      // Persist for future lookups
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const origin = request.headers.get("origin") || request.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://threely.co";

  const portalSession = await stripeClient.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/profile`,
  });

  return NextResponse.json({ url: portalSession.url });
}

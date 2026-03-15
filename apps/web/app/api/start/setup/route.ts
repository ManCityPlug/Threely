import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { notifyNewSignup } from "@/lib/discord";

// ─── POST /api/start/setup — ensure Prisma user + Stripe customer + SetupIntent ─
// Works for both email/password users (already have Stripe customer) and OAuth users (need one)

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get user email from Supabase
    const { data: { user: supaUser } } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const email = supaUser?.email;
    if (!email) return NextResponse.json({ error: "No email found." }, { status: 400 });

    // Upsert Prisma user
    let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: { id: user.id, email },
      });
    }

    // Create Stripe customer if needed
    const stripeClient = getStripe();
    let customerId = dbUser.stripeCustomerId;

    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });

      // Discord notification for new OAuth signup (fire and forget)
      notifyNewSignup(email);
    }

    // Create SetupIntent
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      metadata: { userId: user.id, plan: "yearly" },
    });

    return NextResponse.json({
      setupIntentClientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err: unknown) {
    console.error("[start/setup] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

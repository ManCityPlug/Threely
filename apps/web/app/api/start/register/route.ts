import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { notifyNewSignup } from "@/lib/discord";
import { checkRateLimit } from "@/lib/rate-limit";

// ─── POST /api/start/register — create user + Stripe customer + SetupIntent ──

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Password must include uppercase, lowercase, and a number." }, { status: 400 });
    }

    // ── Rate limit by IP ────────────────────────────────────────────────────
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = checkRateLimit(`register:${clientIp}`);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    // ── Create Supabase user ────────────────────────────────────────────────
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message?.includes("already been registered")) {
        return NextResponse.json({ error: "Unable to create account. If you already have an account, please sign in." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // ── Create Prisma User record ───────────────────────────────────────────
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: {},
      create: { id: data.user.id, email },
    });

    // ── Create Stripe customer ──────────────────────────────────────────────
    const stripeClient = getStripe();
    const customer = await stripeClient.customers.create({
      email,
      metadata: { userId: data.user.id },
    });

    await prisma.user.update({
      where: { id: data.user.id },
      data: { stripeCustomerId: customer.id },
    });

    // ── Create SetupIntent for card collection ──────────────────────────────
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customer.id,
      usage: "off_session",
      metadata: { userId: data.user.id, plan: "yearly" },
    });

    // Discord notification (fire and forget)
    notifyNewSignup(email);

    return NextResponse.json({
      userId: data.user.id,
      setupIntentClientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (err: unknown) {
    console.error("[start/register] Error:", err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

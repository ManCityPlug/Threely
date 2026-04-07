import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, PRICE_YEARLY } from "@/lib/stripe";
import { sendRenewalReminder } from "@/lib/email";

// Vercel cron — runs daily.
// Finds active subscribers whose next renewal is exactly 3 days away and emails them.
// Triggered via vercel.json crons, protected by CRON_SECRET.

const REMINDER_WINDOW_DAYS = 3;
const WINDOW_TOLERANCE_HOURS = 12; // ±12 hours so a daily run catches everyone in a 24h band

function isWithinTargetWindow(periodEndUnix: number): boolean {
  const targetMs = Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const diffHours = Math.abs(periodEndUnix * 1000 - targetMs) / (60 * 60 * 1000);
  return diffHours <= WINDOW_TOLERANCE_HOURS;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Pull all users with an active or trialing Stripe subscription. We
    // intentionally re-check Stripe to get the authoritative renewal date.
    const candidates = await prisma.user.findMany({
      where: {
        subscriptionId: { not: null },
        subscriptionStatus: { in: ["active", "trialing"] },
        email: { not: { endsWith: "@anon.threely.local" } },
      },
      select: { id: true, email: true, subscriptionId: true, pauseEndsAt: true },
    });

    const stripeClient = getStripe();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const u of candidates) {
      // Skip users currently paused — they won't be billed soon
      if (u.pauseEndsAt && u.pauseEndsAt > new Date()) {
        skipped++;
        continue;
      }

      try {
        const sub = await stripeClient.subscriptions.retrieve(u.subscriptionId!);

        // Skip cancellations + already-paused
        if (sub.cancel_at_period_end) { skipped++; continue; }
        if (sub.pause_collection) { skipped++; continue; }
        if (sub.status !== "active" && sub.status !== "trialing") { skipped++; continue; }

        const periodEnd = sub.current_period_end;
        if (!periodEnd || !isWithinTargetWindow(periodEnd)) {
          skipped++;
          continue;
        }

        const item = sub.items.data[0];
        const priceId = item?.price?.id;
        const amount = item?.price?.unit_amount ?? 0;
        const currency = item?.price?.currency ?? "usd";
        const planName: "Yearly" | "Monthly" = priceId === PRICE_YEARLY ? "Yearly" : "Monthly";
        const renewalDate = formatDate(new Date(periodEnd * 1000));

        await sendRenewalReminder(
          u.email,
          planName,
          formatCurrency(amount, currency),
          renewalDate
        );
        sent++;
      } catch (e) {
        console.error(`[renewal-reminders] Failed for ${u.id}:`, e);
        failed++;
      }
    }

    return NextResponse.json({
      total: candidates.length,
      sent,
      skipped,
      failed,
    });
  } catch (e) {
    console.error("[renewal-reminders]", e);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

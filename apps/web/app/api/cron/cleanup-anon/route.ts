import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { cancelAndTombstoneCustomer } from "@/lib/stripe";

// Vercel cron — runs daily to delete unconverted anonymous users older than 7 days
// Triggered via vercel.json cron schedule, protected by CRON_SECRET
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Find Prisma users with anon placeholder emails older than 7 days
    const anonUsers = await prisma.user.findMany({
      where: {
        email: { endsWith: "@anon.threely.local" },
        createdAt: { lt: sevenDaysAgo },
      },
      select: { id: true, stripeCustomerId: true },
    });

    let deleted = 0;
    for (const u of anonUsers) {
      try {
        // Stripe cleanup first (cancel subs + tombstone). Anon users
        // sometimes get a Stripe customer created during checkout before
        // they finish signup; this catches those.
        await cancelAndTombstoneCustomer({
          stripeCustomerId: u.stripeCustomerId,
          threelyUserId: u.id,
        });
        // Delete from Supabase auth (cascades to RLS-protected tables)
        await supabaseAdmin.auth.admin.deleteUser(u.id);
        // Delete from Prisma (goals/tasks/profile cascade via FK)
        await prisma.user.delete({ where: { id: u.id } });
        deleted++;
      } catch (e) {
        console.error(`[cleanup-anon] Failed to delete ${u.id}:`, e);
      }
    }

    return NextResponse.json({ deleted, total: anonUsers.length });
  } catch (e) {
    console.error("[cleanup-anon]", e);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

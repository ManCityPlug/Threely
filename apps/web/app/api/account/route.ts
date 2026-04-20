import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";
import { cancelAndTombstoneCustomer } from "@/lib/stripe";

// DELETE /api/account — permanently delete the current user's account and all data
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require password re-authentication before irreversible deletion
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  if (!body.password || typeof body.password !== "string") {
    return NextResponse.json({ error: "Password is required to delete your account" }, { status: 400 });
  }

  // Verify password using an ephemeral client with anon key (not admin)
  // to avoid bypassing auth policies and to isolate the session
  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });

  if (signInError) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  // Immediately revoke the session created during password verification
  await verifyClient.auth.signOut();

  try {
    // 0. Stripe cleanup first — cancel any active subs + tombstone the
    //    customer record. Keep the Stripe customer around for dispute /
    //    refund history (Option B). Never blocks the delete — Stripe
    //    errors are logged and swallowed inside cancelAndTombstoneCustomer.
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    await cancelAndTombstoneCustomer({
      stripeCustomerId: dbUser?.stripeCustomerId ?? null,
      threelyUserId: user.id,
    });

    // Explicitly delete all user data in dependency order to guarantee cleanup.
    // Even though schema has onDelete: Cascade, we do explicit deletes as a safety net.

    // 1. Delete daily reviews (depend on daily_tasks)
    await prisma.dailyReview.deleteMany({ where: { userId: user.id } });

    // 2. Delete daily tasks (depend on goals + users)
    await prisma.dailyTask.deleteMany({ where: { userId: user.id } });

    // 3. Delete daily focus records
    await prisma.dailyFocus.deleteMany({ where: { userId: user.id } });

    // 4. Delete weekly summaries
    await prisma.weeklySummary.deleteMany({ where: { userId: user.id } });

    // 5. Delete goals
    await prisma.goal.deleteMany({ where: { userId: user.id } });

    // 6. Delete user profile
    await prisma.userProfile.deleteMany({ where: { userId: user.id } });

    // 7. Delete the user record itself
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {
      // User may not exist in Prisma (e.g. OAuth-only, never completed onboarding)
    });

    // 8. Delete from Supabase auth (requires service role)
    await supabaseAdmin.auth.admin.deleteUser(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account/delete] Error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}

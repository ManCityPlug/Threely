import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";

// DELETE /api/account — permanently delete the current user's account and all data
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Delete the Prisma user — cascades to goals, daily_tasks, reviews, etc.
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {
      // User may not exist in Prisma yet (e.g. never completed onboarding)
    });

    // Delete from Supabase auth.users (requires service role)
    await supabaseAdmin.auth.admin.deleteUser(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[account/delete] Error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}

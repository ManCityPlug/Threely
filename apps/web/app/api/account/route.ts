import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, supabaseAdmin } from "@/lib/supabase";

// DELETE /api/account — permanently delete the current user's account and all data
export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete the Prisma user — cascades to goals and daily_tasks
  await prisma.user.delete({ where: { id: user.id } });

  // Delete from Supabase auth.users (requires service role)
  await supabaseAdmin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}

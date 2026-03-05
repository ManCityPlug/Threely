import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dismissals = await prisma.notificationDismissal.findMany({
    where: { userId: user.id },
    select: { notificationId: true },
  });
  const dismissedIds = new Set(dismissals.map((d) => d.notificationId));

  // Only show notifications created after the user signed up
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } });
  const userCreatedAt = dbUser?.createdAt ?? new Date(0);

  const allNotifications = await prisma.notification.findMany({
    where: { createdAt: { gte: userCreatedAt } },
    orderBy: { createdAt: "desc" },
  });

  // Filter: show if targeted to this user OR if no targeting (global)
  // Then exclude dismissed
  const visible = allNotifications.filter((n) => {
    const isTargeted = n.targetUserIds.length > 0;
    if (isTargeted && !n.targetUserIds.includes(user.id)) return false;
    return !dismissedIds.has(n.id);
  });

  return NextResponse.json({
    notifications: visible,
    unreadCount: visible.length,
  });
}

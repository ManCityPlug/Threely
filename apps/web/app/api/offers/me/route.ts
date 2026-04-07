import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark expired offers as expired (cleanup)
  await prisma.offer.updateMany({
    where: {
      userId: authUser.id,
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });

  // Find an active offer for this user
  const offer = await prisma.offer.findFirst({
    where: {
      userId: authUser.id,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ offer });
}

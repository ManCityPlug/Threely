import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Mark expired pending offers as expired
  await prisma.offer.updateMany({
    where: {
      userId: id,
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });

  const offers = await prisma.offer.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ offers });
}

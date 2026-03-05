import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.notificationDismissal.upsert({
    where: {
      userId_notificationId: {
        userId: user.id,
        notificationId: id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      notificationId: id,
    },
  });

  return NextResponse.json({ success: true });
}

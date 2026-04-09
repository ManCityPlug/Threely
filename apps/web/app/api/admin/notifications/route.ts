import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { dismissals: true } },
    },
  });

  // Resolve target user IDs to emails for display
  const allTargetIds = [...new Set(notifications.flatMap((n) => n.targetUserIds))];
  const targetUsers =
    allTargetIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allTargetIds } },
          select: { id: true, email: true },
        })
      : [];
  const idToEmail = new Map(targetUsers.map((u) => [u.id, u.email]));

  const enriched = notifications.map((n) => ({
    ...n,
    targetEmails: n.targetUserIds.map((id) => idToEmail.get(id) ?? id),
  }));

  return NextResponse.json({ notifications: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { heading, subheading, linkUrl, targetEmails } = body;

  if (!heading || !subheading || typeof heading !== 'string' || typeof subheading !== 'string') {
    return NextResponse.json(
      { error: "Heading and subheading are required and must be strings" },
      { status: 400 }
    );
  }

  if (linkUrl) {
    try {
      const parsed = new URL(linkUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: "linkUrl must use https:// or http://" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid linkUrl format" },
        { status: 400 }
      );
    }
  }

  // Resolve emails to user IDs if targeting specific users
  let targetUserIds: string[] = [];
  if (targetEmails && Array.isArray(targetEmails) && targetEmails.length > 0) {
    const emails = targetEmails
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      });

      const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
      const notFound = emails.filter((e: string) => !foundEmails.has(e));

      if (notFound.length > 0) {
        return NextResponse.json(
          { error: `Users not found: ${notFound.join(", ")}` },
          { status: 400 }
        );
      }

      targetUserIds = users.map((u) => u.id);
    }
  }

  const notification = await prisma.notification.create({
    data: {
      heading,
      subheading,
      linkUrl: linkUrl || null,
      targetUserIds,
    },
  });

  return NextResponse.json({ notification }, { status: 201 });
}

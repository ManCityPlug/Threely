import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

// GET /api/tasks/history?days=7&cursor=DATE&limit=14
// Returns daily tasks for the past N days with cursor-based pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "14", 10), 90);
    const cursor = searchParams.get("cursor");

    // Support both old `days` param and new cursor-based pagination
    const days = searchParams.get("days");

    let since: Date;
    if (cursor) {
      since = new Date(cursor);
      since.setUTCHours(0, 0, 0, 0);
    } else if (days) {
      since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (parseInt(days, 10) - 1));
    } else {
      since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (limit - 1));
    }

    const dailyTasks = await prisma.dailyTask.findMany({
      where: { userId: user.id, date: { gte: since } },
      include: { goal: { select: { id: true, title: true, description: true } } },
      orderBy: { date: "desc" },
      take: limit + 1, // Fetch one extra to determine nextCursor
    });

    let nextCursor: string | null = null;
    if (dailyTasks.length > limit) {
      const extra = dailyTasks.pop()!;
      const extraDate = new Date(extra.date);
      extraDate.setDate(extraDate.getDate() - 1);
      nextCursor = extraDate.toISOString().split("T")[0];
    }

    return NextResponse.json({ dailyTasks, ...(nextCursor ? { nextCursor } : {}) });
  } catch (e) {
    console.error("[GET /api/tasks/history]", e);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

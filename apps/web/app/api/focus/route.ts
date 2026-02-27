import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

// GET /api/focus?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr + "T00:00:00.000Z");

    const focus = await prisma.dailyFocus.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });

    return NextResponse.json({ focus });
  } catch (e) {
    console.error("[/api/focus GET]", e);
    return NextResponse.json({ error: "Failed to fetch focus" }, { status: 500 });
  }
}

// POST /api/focus { focusGoalId, shuffleTaskIds? }
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { focusGoalId, shuffleTaskIds, localDate } = body as {
      focusGoalId: string;
      shuffleTaskIds?: string[];
      localDate?: string;
    };

    if (!focusGoalId) {
      return NextResponse.json({ error: "focusGoalId is required" }, { status: 400 });
    }

    // Use client's local date if provided, otherwise fall back to UTC
    const today = localDate
      ? new Date(localDate + "T00:00:00.000Z")
      : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

    const focus = await prisma.dailyFocus.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      create: {
        userId: user.id,
        date: today,
        focusGoalId,
        shuffleTaskIds: shuffleTaskIds ?? Prisma.JsonNull,
      },
      update: {
        focusGoalId,
        shuffleTaskIds: shuffleTaskIds ?? Prisma.JsonNull,
      },
    });

    return NextResponse.json({ focus });
  } catch (e) {
    console.error("[/api/focus POST]", e);
    return NextResponse.json({ error: "Failed to save focus" }, { status: 500 });
  }
}

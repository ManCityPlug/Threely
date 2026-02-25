import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

// GET /api/goals — list all active goals for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includePaused = searchParams.get("includePaused") === "true";

    const goals = await prisma.goal.findMany({
      where: {
        userId: user.id,
        isActive: true,
        ...(includePaused ? {} : { isPaused: false }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ goals });
  } catch (e) {
    console.error("[GET /api/goals]", e);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

// POST /api/goals — create a new goal
// Body: { title, description?, rawInput?, structuredSummary?, category?, deadline? }
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, rawInput, structuredSummary, category, deadline, dailyTimeMinutes, intensityLevel, focusDays } = body as {
    title: string;
    description?: string;
    rawInput?: string;
    structuredSummary?: string;
    category?: string;
    deadline?: string; // ISO date string
    dailyTimeMinutes?: number;
    intensityLevel?: number;
    focusDays?: string[]; // e.g. ["monday","wednesday","friday"]
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Ensure user record exists (upsert in case they just registered)
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email },
    update: {},
  });

  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      rawInput: rawInput?.trim() ?? title.trim(),
      structuredSummary: structuredSummary?.trim() ?? null,
      category: category?.trim() ?? null,
      deadline: deadline ? new Date(deadline) : null,
      dailyTimeMinutes: dailyTimeMinutes ?? null,
      intensityLevel: intensityLevel ?? null,
      focusDays: focusDays ? JSON.stringify(focusDays) : null,
    },
  });

  return NextResponse.json({ goal }, { status: 201 });
}

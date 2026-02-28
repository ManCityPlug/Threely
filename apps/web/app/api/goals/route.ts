import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { notifyGoalCreated } from "@/lib/discord";
import { generateRoadmap } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";

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

  // Pro gate
  const access = await getUserAccess(user.id);
  if (!access.hasPro) {
    return NextResponse.json({
      error: "pro_required",
      message: "Subscribe to keep your momentum going",
      trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
    }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, rawInput, structuredSummary, category, deadline, dailyTimeMinutes, intensityLevel, workDays } = body as {
    title: string;
    description?: string;
    rawInput?: string;
    structuredSummary?: string;
    category?: string;
    deadline?: string; // ISO date string
    dailyTimeMinutes?: number;
    intensityLevel?: number;
    workDays?: number[];
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
      ...(workDays ? { workDays } : {}),
    },
  });

  // Discord notification with goal counts
  const totalGoals = await prisma.goal.count({ where: { userId: user.id } });
  const activeGoals = await prisma.goal.count({ where: { userId: user.id, isActive: true } });
  notifyGoalCreated(user.email ?? "unknown", goal.title, goal.category, { total: totalGoals, active: activeGoals });

  // Generate roadmap with Opus (async — don't block the response)
  // Load user profile for context
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  try {
    const roadmap = await generateRoadmap({
      title: goal.title,
      rawInput: goal.rawInput,
      structuredSummary: goal.structuredSummary ?? null,
      category: goal.category ?? null,
      deadline: goal.deadline ?? null,
      dailyTimeMinutes: goal.dailyTimeMinutes ?? profile?.dailyTimeMinutes ?? 60,
      intensityLevel: goal.intensityLevel ?? profile?.intensityLevel ?? 2,
    });

    await prisma.goal.update({
      where: { id: goal.id },
      data: { roadmap },
    });

    // Return goal with roadmap
    return NextResponse.json({ goal: { ...goal, roadmap } }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/goals] Roadmap generation failed:", e);
    // Return goal without roadmap — task generation still works, just without the master plan
    return NextResponse.json({ goal }, { status: 201 });
  }
}

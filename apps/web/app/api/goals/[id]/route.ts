import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { notifyGoalDeleted } from "@/lib/discord";

type Params = { params: Promise<{ id: string }> };

// GET /api/goals/:id
export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findFirst({
    where: { id, userId: user.id },
  });

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
}

// PATCH /api/goals/:id — update title, description, or isActive
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, description, isActive, isPaused, rawInput, structuredSummary, category, deadline, dailyTimeMinutes, intensityLevel, workDays } = body as {
    title?: string;
    description?: string;
    isActive?: boolean;
    isPaused?: boolean;
    rawInput?: string;
    structuredSummary?: string;
    category?: string;
    deadline?: string | null;
    dailyTimeMinutes?: number | null;
    intensityLevel?: number | null;
    workDays?: number[];
  };

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(isActive !== undefined && { isActive }),
      ...(isPaused !== undefined && { isPaused }),
      ...(rawInput !== undefined && { rawInput }),
      ...(structuredSummary !== undefined && { structuredSummary }),
      ...(category !== undefined && { category }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(dailyTimeMinutes !== undefined && { dailyTimeMinutes }),
      ...(intensityLevel !== undefined && { intensityLevel }),
      ...(workDays !== undefined && { workDays }),
    },
  });

  return NextResponse.json({ goal });
}

// DELETE /api/goals/:id — permanently delete the goal and its daily tasks
export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });

  // Discord notification with updated counts
  const totalGoals = await prisma.goal.count({ where: { userId: user.id } });
  const activeGoals = await prisma.goal.count({ where: { userId: user.id, isActive: true } });
  notifyGoalDeleted(user.email ?? "unknown", existing.title, { total: totalGoals, active: activeGoals });

  return NextResponse.json({ success: true });
}

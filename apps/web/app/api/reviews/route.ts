import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
}

// POST /api/reviews
// Body: { dailyTaskId, difficultyRating, completionStatus?, userNote? }
// completionStatus is optional — when omitted, auto-computed from task items.
// Saves a daily review (upserts so re-submitting overwrites).
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { dailyTaskId, difficultyRating, completionStatus: providedStatus, userNote } = body as {
    dailyTaskId?: string;
    difficultyRating?: string;
    completionStatus?: string;
    userNote?: string;
  };

  if (!dailyTaskId || !difficultyRating) {
    return NextResponse.json(
      { error: "dailyTaskId and difficultyRating are required" },
      { status: 400 }
    );
  }

  // Verify the dailyTask belongs to this user
  const dailyTask = await prisma.dailyTask.findFirst({
    where: { id: dailyTaskId, userId: user.id },
  });
  if (!dailyTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auto-compute completionStatus if not provided
  let completionStatus = providedStatus;
  if (!completionStatus) {
    const items = dailyTask.tasks as unknown as TaskItem[];
    const completedCount = items.filter((t) => t.isCompleted).length;
    if (completedCount === items.length) {
      completionStatus = "completed_all";
    } else if (completedCount > 0) {
      completionStatus = "completed_some";
    } else {
      completionStatus = "completed_none";
    }
  }

  const review = await prisma.dailyReview.upsert({
    where: { dailyTaskId },
    create: {
      dailyTaskId,
      userId: user.id,
      difficultyRating,
      completionStatus,
      userNote: userNote ?? null,
    },
    update: {
      difficultyRating,
      completionStatus,
      userNote: userNote ?? null,
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}

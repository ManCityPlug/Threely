import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

interface TaskItem {
  id: string;
  isCompleted: boolean;
  isSkipped?: boolean;
}

const VALID_DIFFICULTY_RATINGS = ["too_easy", "just_right", "too_hard"] as const;
const VALID_COMPLETION_STATUSES = ["completed_all", "completed_some", "completed_none"] as const;
const MAX_USER_NOTE_LENGTH = 2000;

// POST /api/reviews
// Body: { dailyTaskId, difficultyRating, completionStatus?, userNote? }
// completionStatus is optional — when omitted, auto-computed from task items.
// Saves a daily review (upserts so re-submitting overwrites).
export async function POST(request: NextRequest) {
  try {
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

    if (!(VALID_DIFFICULTY_RATINGS as readonly string[]).includes(difficultyRating)) {
      return NextResponse.json(
        { error: `difficultyRating must be one of: ${VALID_DIFFICULTY_RATINGS.join(", ")}` },
        { status: 400 }
      );
    }

    if (providedStatus && !(VALID_COMPLETION_STATUSES as readonly string[]).includes(providedStatus)) {
      return NextResponse.json(
        { error: `completionStatus must be one of: ${VALID_COMPLETION_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (userNote && userNote.length > MAX_USER_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `userNote must not exceed ${MAX_USER_NOTE_LENGTH} characters` },
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
      const items = Array.isArray(dailyTask.tasks) ? (dailyTask.tasks as unknown as TaskItem[]) : [];
      const completedCount = items.filter((t) => t.isCompleted).length;
      if (items.length === 0 || completedCount === items.length) {
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
  } catch (e) {
    console.error("[POST /api/reviews]", e);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}

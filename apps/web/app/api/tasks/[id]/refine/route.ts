import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { refineTask } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";

type Params = { params: Promise<{ id: string }> };

interface TaskResource {
  type: "youtube_channel" | "tool" | "website" | "book" | "app";
  name: string;
  detail: string;
}

interface TaskItem {
  id: string;
  task: string;
  description: string;
  estimated_minutes: number;
  goal_id: string;
  why: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  isRescheduled?: boolean;
  resources?: TaskResource[];
}

export const maxDuration = 30;

// POST /api/tasks/:id/refine
// Body: { taskItemId: string, userRequest: string }
// Refines a single task item using AI based on user feedback.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Pro gate
    const access = await getUserAccess(user.id);
    if (!access.hasPro) {
      return NextResponse.json({
        error: "pro_required",
        message: "Subscribe to keep your momentum going",
        trialEndsAt: access.trialEndsAt?.toISOString() ?? null,
      }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { taskItemId, userRequest } = body as {
      taskItemId: string;
      userRequest: string;
    };

    if (!taskItemId || !userRequest?.trim()) {
      return NextResponse.json({ error: "taskItemId and userRequest are required" }, { status: 400 });
    }

    const dailyTask = await prisma.dailyTask.findFirst({
      where: { id, userId: user.id },
      include: { goal: true },
    });
    if (!dailyTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tasks = dailyTask.tasks as unknown as TaskItem[];
    const targetTask = tasks.find((t) => t.id === taskItemId);
    if (!targetTask) return NextResponse.json({ error: "Task item not found" }, { status: 404 });

    const refined = await refineTask({
      task: targetTask.task,
      description: targetTask.description,
      why: targetTask.why,
      goalTitle: dailyTask.goal.title,
      goalCategory: dailyTask.goal.category,
      userRequest: userRequest.trim(),
      userId: user.id,
      goalId: dailyTask.goalId,
    });

    const updatedTasks = tasks.map((t) =>
      t.id === taskItemId
        ? { ...t, task: refined.task, description: refined.description, why: refined.why }
        : t
    );

    const updated = await prisma.dailyTask.update({
      where: { id },
      data: { tasks: updatedTasks as never },
    });

    return NextResponse.json({ dailyTask: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("Request timed out");
    console.error("[POST /api/tasks/:id/refine]", e);
    if (isTimeout) {
      return NextResponse.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to refine task" }, { status: 500 });
  }
}

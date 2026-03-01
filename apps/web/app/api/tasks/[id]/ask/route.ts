import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { askAboutTask, type TaskResource, type AskAboutTaskResult } from "@/lib/claude";
import { getUserAccess } from "@/lib/subscription";

type Params = { params: Promise<{ id: string }> };

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

// POST /api/tasks/:id/ask
// Body: { taskItemId: string, messages: { role: "user"|"assistant", content: string }[] }
// Returns: { answer: string }
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
    const { taskItemId, messages } = body as {
      taskItemId: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!taskItemId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "taskItemId and messages are required" }, { status: 400 });
    }

    // Enforce 20-message conversation limit
    if (messages.length > 20) {
      return NextResponse.json({ error: "Conversation limit reached (20 messages)" }, { status: 400 });
    }

    const dailyTask = await prisma.dailyTask.findFirst({
      where: { id, userId: user.id },
      include: { goal: true },
    });
    if (!dailyTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tasks = dailyTask.tasks as unknown as TaskItem[];
    const targetTask = tasks.find((t) => t.id === taskItemId);
    if (!targetTask) return NextResponse.json({ error: "Task item not found" }, { status: 404 });

    // Fetch user profile for intensity level
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    const result = await askAboutTask({
      task: targetTask.task,
      description: targetTask.description,
      why: targetTask.why,
      resources: targetTask.resources,
      goalTitle: dailyTask.goal.title,
      goalCategory: dailyTask.goal.category,
      goalSummary: dailyTask.goal.structuredSummary,
      intensityLevel: profile?.intensityLevel ?? 2,
      messages,
    });

    return NextResponse.json({ answer: result.answer, options: result.options });
  } catch (e) {
    console.error("[POST /api/tasks/:id/ask]", e);
    return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
  }
}

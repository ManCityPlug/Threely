import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { clearStatsCache } from "@/lib/stats-cache";
import { notifyFirstTaskComplete } from "@/lib/discord";

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
}

// PATCH /api/tasks/:id
// Body: { taskItemId: string, isCompleted: boolean } OR { taskItemId: string, action: "skip" | "reschedule" }
// Toggles a single task item inside the tasks JSON array.
// When all items are complete, skipped, or rescheduled, marks the DailyTask record as completed.
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { taskItemId, isCompleted, action, editData } = body as {
      taskItemId: string;
      isCompleted?: boolean;
      action?: "skip" | "reschedule" | "edit";
      editData?: { task?: string; description?: string };
    };

    if (!taskItemId) {
      return NextResponse.json({ error: "taskItemId is required" }, { status: 400 });
    }

    const dailyTask = await prisma.dailyTask.findFirst({
      where: { id, userId: user.id },
    });
    if (!dailyTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tasks = Array.isArray(dailyTask.tasks) ? (dailyTask.tasks as unknown as TaskItem[]) : [];
    if (tasks.length === 0) {
      return NextResponse.json({ error: "No tasks found in this daily task" }, { status: 404 });
    }
    let updatedTasks: TaskItem[];

    if (action === "skip") {
      updatedTasks = tasks.map((t) =>
        t.id === taskItemId ? { ...t, isSkipped: true } : t
      );
    } else if (action === "reschedule") {
      updatedTasks = tasks.map((t) =>
        t.id === taskItemId ? { ...t, isRescheduled: true } : t
      );

      // Copy task to tomorrow
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const taskToCopy = tasks.find(t => t.id === taskItemId);
      if (taskToCopy) {
        const rescheduledTask = {
          ...taskToCopy,
          id: `task-${Date.now()}-rescheduled`,
          isCompleted: false,
          isSkipped: undefined,
          isRescheduled: undefined,
        };

        const existingTomorrow = await prisma.dailyTask.findUnique({
          where: { goalId_date: { goalId: dailyTask.goalId, date: tomorrow } },
        });

        if (existingTomorrow) {
          const tomorrowTasks = existingTomorrow.tasks as unknown as TaskItem[];
          await prisma.dailyTask.update({
            where: { goalId_date: { goalId: dailyTask.goalId, date: tomorrow } },
            data: { tasks: [...tomorrowTasks, rescheduledTask] as never },
          });
        } else {
          try {
            await prisma.dailyTask.create({
              data: {
                userId: user.id,
                goalId: dailyTask.goalId,
                date: tomorrow,
                tasks: [rescheduledTask] as never,
              },
            });
          } catch (createErr: unknown) {
            // Unique constraint race — another request created tomorrow's record first
            if (createErr instanceof Error && createErr.message.includes("Unique constraint")) {
              const justCreated = await prisma.dailyTask.findUnique({
                where: { goalId_date: { goalId: dailyTask.goalId, date: tomorrow } },
              });
              if (justCreated) {
                const existingItems = justCreated.tasks as unknown as TaskItem[];
                await prisma.dailyTask.update({
                  where: { goalId_date: { goalId: dailyTask.goalId, date: tomorrow } },
                  data: { tasks: [...existingItems, rescheduledTask] as never },
                });
              }
            } else {
              throw createErr;
            }
          }
        }
      }
    } else if (action === "edit") {
      updatedTasks = tasks.map((t) =>
        t.id === taskItemId
          ? {
              ...t,
              ...(editData?.task !== undefined && { task: editData.task }),
              ...(editData?.description !== undefined && { description: editData.description }),
            }
          : t
      );
    } else {
      updatedTasks = tasks.map((t) =>
        t.id === taskItemId ? { ...t, isCompleted: isCompleted ?? !t.isCompleted } : t
      );
    }

    const allDone = updatedTasks.every((t) => t.isCompleted || t.isSkipped || t.isRescheduled);

    const updated = await prisma.dailyTask.update({
      where: { id },
      data: {
        tasks: updatedTasks as never,
        isCompleted: allDone,
        completedAt: allDone ? new Date() : null,
      },
    });

    clearStatsCache(user.id);

    // Update AI call log with feedback (fire-and-forget)
    const feedbackValue = action || (isCompleted !== undefined ? (body.isCompleted ? 'completed' : 'uncompleted') : null);
    if (feedbackValue) {
      prisma.aICallLog.updateMany({
        where: {
          goalId: dailyTask.goalId,
          functionName: 'generateTasks',
          userId: user.id,
        },
        data: {
          taskFeedback: feedbackValue,
          feedbackAt: new Date(),
        },
      }).catch(() => {});
    }

    // Check for first-ever task completion
    if (!action && isCompleted) {
      // Count total completed tasks across all daily tasks for this user
      const allUserTasks = await prisma.dailyTask.findMany({
        where: { userId: user.id },
        select: { tasks: true },
      });
      let totalCompleted = 0;
      for (const dt of allUserTasks) {
        const items = dt.tasks as unknown as TaskItem[];
        totalCompleted += items.filter(t => t.isCompleted).length;
      }
      // If exactly 1 completed task, this was their first ever
      if (totalCompleted === 1) {
        const goal = await prisma.goal.findUnique({ where: { id: dailyTask.goalId }, select: { title: true } });
        notifyFirstTaskComplete(user.email ?? "unknown", goal?.title ?? "Unknown goal");
      }
    }

    return NextResponse.json({ dailyTask: updated });
  } catch (e) {
    console.error("[PATCH /api/tasks/:id]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

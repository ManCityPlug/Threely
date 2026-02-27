import { supabase } from "./supabase";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  rawInput: string;
  structuredSummary: string | null;
  category: string | null;
  deadline: string | null;
  dailyTimeMinutes: number | null;
  intensityLevel: number | null;
  workDays: number[];
  isActive: boolean;
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  task: string;
  description: string;
  estimated_minutes: number;
  goal_id: string;
  why: string;
  isCompleted: boolean;
  isSkipped?: boolean;
  isRescheduled?: boolean;
  isCarriedOver?: boolean;
  carriedFromDate?: string;
}

export interface DailyTask {
  id: string;
  userId: string;
  goalId: string;
  date: string;
  tasks: TaskItem[];
  isCompleted: boolean;
  completedAt: string | null;
  generatedAt: string;
  goal?: Pick<Goal, "id" | "title" | "description">;
  review?: DailyReview | null;
}

export interface UserProfile {
  id: string;
  userId: string;
  dailyTimeMinutes: number;
  intensityLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedGoal {
  short_title: string;
  structured_summary: string;
  category: string;
  deadline_detected: string | null;
  daily_time_detected: number | null;
  work_days_detected: number[] | null;
  needs_more_context: boolean;
  recommendations: string | null;
}

export interface DailyReview {
  id: string;
  dailyTaskId: string;
  userId: string;
  difficultyRating: string;
  completionStatus: string;
  userNote: string | null;
  insight?: string | null;
  createdAt: string;
}

export interface GoalStat {
  goalId: string;
  title: string;
  lastWorkedAt: string | null;
  overdueCount: number;
  dailyTimeMinutes: number | null;
  lifetimeCompleted: number;
  lifetimeTotal: number;
}

export interface Stats {
  totalCompleted: number;
  activeGoals: number;
  streak: number;
  totalHoursInvested: number;
  goalStats: GoalStat[];
}

export interface SubscriptionStatus {
  status: "trialing" | "active" | "past_due" | "canceled" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export interface SubscriptionSetup {
  setupIntentClientSecret: string;
  ephemeralKeySecret: string;
  customerId: string;
  subscriptionId?: string;
  isResubscribe?: boolean;
}

export interface GoalChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GoalChatResult {
  message: string;
  options: string[];
  done: boolean;
  goal_text: string | null;
  raw_reply: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not authenticated");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}): unexpected response from server`);
  }
  if (!res.ok) {
    throw new Error((json.error as string) ?? `Request failed: ${res.status}`);
  }
  return json as T;
}

// ─── Profile API ──────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => apiFetch<{ profile: UserProfile | null }>("/api/profile"),

  save: (data: { dailyTimeMinutes: number; intensityLevel: number }) =>
    apiFetch<{ profile: UserProfile }>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Goals API ───────────────────────────────────────────────────────────────

export const goalsApi = {
  list: (includePaused?: boolean) => {
    const q = includePaused ? "?includePaused=true" : "";
    return apiFetch<{ goals: Goal[] }>(`/api/goals${q}`);
  },

  parse: (rawInput: string) =>
    apiFetch<ParsedGoal>("/api/goals/parse", {
      method: "POST",
      body: JSON.stringify({ rawInput }),
    }),

  create: (
    title: string,
    options?: {
      description?: string;
      rawInput?: string;
      structuredSummary?: string;
      category?: string;
      deadline?: string;
      dailyTimeMinutes?: number;
      intensityLevel?: number;
      workDays?: number[];
    }
  ) =>
    apiFetch<{ goal: Goal }>("/api/goals", {
      method: "POST",
      body: JSON.stringify({ title, ...options }),
    }),

  update: (id: string, data: Partial<Pick<Goal, "title" | "description" | "isActive" | "rawInput" | "structuredSummary" | "category" | "deadline" | "dailyTimeMinutes" | "intensityLevel" | "workDays">>) =>
    apiFetch<{ goal: Goal }>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  markComplete: (id: string) =>
    apiFetch<{ goal: Goal }>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/goals/${id}`, { method: "DELETE" }),

  chat: (messages: GoalChatMessage[]) =>
    apiFetch<GoalChatResult>("/api/goals/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
};

// ─── Tasks API ────────────────────────────────────────────────────────────────

export const tasksApi = {
  today: (includeOverdue?: boolean, date?: string) => {
    const params = new URLSearchParams();
    // Always send the device's local date so the server matches local timezone
    const now = new Date();
    const localDate = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    params.set("date", localDate);
    if (includeOverdue) params.set("includeOverdue", "true");
    const qs = `?${params.toString()}`;
    return apiFetch<{ dailyTasks: DailyTask[]; overdueTasks: DailyTask[]; restDay?: boolean }>(`/api/tasks${qs}`);
  },

  history: (days = 14) =>
    apiFetch<{ dailyTasks: DailyTask[] }>(`/api/tasks/history?days=${days}`),

  generate: (
    goalId?: string,
    options?: {
      requestingAdditional?: boolean;
      focusShifted?: boolean;
      postReview?: boolean;
    }
  ) => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ dailyTasks: DailyTask[]; coachNote?: string; restDay?: boolean }>("/api/tasks/generate", {
      method: "POST",
      body: JSON.stringify({ goalId, localDate, ...options }),
    });
  },

  completeItem: (dailyTaskId: string, taskItemId: string, isCompleted: boolean) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ taskItemId, isCompleted }),
    }),

  skip: (dailyTaskId: string, taskItemId: string) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ taskItemId, action: "skip" }),
    }),

  reschedule: (dailyTaskId: string, taskItemId: string) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ taskItemId, action: "reschedule" }),
    }),

  editItem: (dailyTaskId: string, taskItemId: string, editData: { task?: string; description?: string }) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ taskItemId, action: "edit", editData }),
    }),

  refineItem: (dailyTaskId: string, taskItemId: string, userRequest: string) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}/refine`, {
      method: "POST",
      body: JSON.stringify({ taskItemId, userRequest }),
    }),
};

// ─── Reviews API ──────────────────────────────────────────────────────────────

export const reviewsApi = {
  create: (data: {
    dailyTaskId: string;
    difficultyRating: string;
    completionStatus?: string;
    userNote?: string;
  }) =>
    apiFetch<{ review: DailyReview }>("/api/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ─── Insights API ─────────────────────────────────────────────────────────────

export const insightsApi = {
  generate: (dailyTaskId: string) =>
    apiFetch<{ insight: string }>("/api/insights", {
      method: "POST",
      body: JSON.stringify({ dailyTaskId }),
    }),
};

// ─── Focus API ───────────────────────────────────────────────────────────────

export interface DailyFocusRecord {
  id: string;
  userId: string;
  date: string;
  focusGoalId: string;
  shuffleTaskIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export const focusApi = {
  get: (date?: string) => {
    const now = new Date();
    const localDate = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ focus: DailyFocusRecord | null }>(`/api/focus?date=${localDate}`);
  },

  save: (focusGoalId: string, shuffleTaskIds?: string[]) => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ focus: DailyFocusRecord }>("/api/focus", {
      method: "POST",
      body: JSON.stringify({ focusGoalId, shuffleTaskIds, localDate }),
    });
  },
};

// ─── Stats API ────────────────────────────────────────────────────────────────

export interface HeatmapDay {
  date: string;
  completed: number;
  total: number;
  percentage: number;
}

export interface WeeklySummary {
  tasksCompleted: number;
  tasksGenerated: number;
  hoursInvested: number;
  goalsWorkedOn: number;
  dailyBreakdown: { date: string; completed: number; total: number }[];
  insight?: string;
}

export const statsApi = {
  get: () => apiFetch<Stats>("/api/stats"),

  heatmap: (days = 90) => {
    const tz = new Date().getTimezoneOffset(); // minutes offset from UTC
    return apiFetch<{ heatmap: HeatmapDay[] }>(`/api/stats/heatmap?days=${days}&tz=${tz}`);
  },
};

export interface WeeklySummaryStatus {
  status: "locked" | "ready" | "available" | "expired";
  unlocksAt?: string;
  weekStart?: string;
  summary?: WeeklySummary;
}

export const summaryApi = {
  weekly: (withInsight = false) =>
    apiFetch<WeeklySummary>(`/api/summary/weekly${withInsight ? "?withInsight=true" : ""}`),
  weeklyStatus: (tz: string) =>
    apiFetch<WeeklySummaryStatus>(`/api/summary/weekly-status?tz=${encodeURIComponent(tz)}`),
  weeklyOpen: (tz: string) =>
    apiFetch<WeeklySummary>("/api/summary/weekly-open", {
      method: "POST",
      body: JSON.stringify({ tz }),
    }),
};

// ─── Account API ──────────────────────────────────────────────────────────────

export const accountApi = {
  delete: () => apiFetch<{ success: boolean }>("/api/account", { method: "DELETE" }),
};

// ─── Subscription API ─────────────────────────────────────────────────────────

export const subscriptionApi = {
  status: () => apiFetch<SubscriptionStatus>("/api/subscription"),

  create: (priceId: string, deviceId: string) =>
    apiFetch<SubscriptionSetup>("/api/subscription", {
      method: "POST",
      body: JSON.stringify({ priceId, deviceId }),
    }),
};

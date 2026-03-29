import { getSupabase } from "./supabase-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskResource {
  type: "youtube_channel" | "tool" | "website" | "book" | "app";
  name: string;
  detail: string;
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
  resources?: TaskResource[];
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  rawInput: string | null;
  structuredSummary: string | null;
  category: string | null;
  deadline: string | null;
  dailyTimeMinutes: number | null;
  intensityLevel: number | null;
  workDays: number[];
  isActive: boolean;
  isPaused: boolean;
  createdAt: string;
}

export interface DailyTask {
  id: string;
  userId: string;
  goalId: string;
  date: string;
  tasks: TaskItem[];
  isCompleted: boolean;
  generatedAt: string;
  goal?: { id: string; title: string; description: string | null };
  review?: DailyReview | null;
}

export interface DailyReview {
  id: string;
  difficultyRating: string;
  completionStatus: string;
  userNote: string | null;
  insight?: string | null;
}

export interface UserProfile {
  dailyTimeMinutes: number;
  intensityLevel: number;
}

export interface GoalStat {
  goalId: string;
  title: string;
  lastWorkedAt: string | null;
  overdueCount: number;
  dailyTimeMinutes: number | null;
  workDays: number[];
  nextWorkDay: string | null;
}

export interface Stats {
  totalCompleted: number;
  activeGoals: number;
  streak: number;
  bestStreak: number;
  totalHoursInvested: number;
  totalMinutesInvested?: number;
  goalStats: GoalStat[];
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

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

// ─── Goals API ────────────────────────────────────────────────────────────────

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

  create: (data: {
    title: string;
    rawInput?: string;
    structuredSummary?: string;
    category?: string;
    deadline?: string | null;
    description?: string;
    dailyTimeMinutes?: number;
    intensityLevel?: number;
    workDays?: number[];
    onboarding?: boolean;
  }) =>
    apiFetch<{ goal: Goal }>("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Goal>) =>
    apiFetch<{ goal: Goal }>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/goals/${id}`, {
      method: "DELETE",
    }),

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
    // Always send the browser's local date so the server matches local timezone
    const now = new Date();
    const localDate = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    params.set("date", localDate);
    if (includeOverdue) params.set("includeOverdue", "true");
    const q = `?${params.toString()}`;
    return apiFetch<{ dailyTasks: DailyTask[]; overdueTasks: DailyTask[]; restDay?: boolean }>(`/api/tasks${q}`);
  },

  generate: (opts?: {
    goalId?: string;
    requestingAdditional?: boolean;
    focusShifted?: boolean;
    postReview?: boolean;
    onboarding?: boolean;
  }) => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ dailyTasks: DailyTask[]; coachNote?: string; restDay?: boolean }>(
      "/api/tasks/generate",
      { method: "POST", body: JSON.stringify({ localDate, ...(opts ?? {}) }) }
    );
  },

  toggleTask: (dailyTaskId: string, taskItemId: string, isCompleted: boolean) =>
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

  askAboutTask: (dailyTaskId: string, taskItemId: string, messages: { role: "user" | "assistant"; content: string }[]) =>
    apiFetch<{ answer: string; options: string[] }>(`/api/tasks/${dailyTaskId}/ask`, {
      method: "POST",
      body: JSON.stringify({ taskItemId, messages }),
    }),

  history: (days = 30, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) {
      params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
    } else {
      params.set("days", String(days));
    }
    return apiFetch<{ dailyTasks: DailyTask[]; nextCursor?: string }>(`/api/tasks/history?${params.toString()}`);
  },
};

// ─── Reviews API ──────────────────────────────────────────────────────────────

export const reviewsApi = {
  submit: (data: {
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

// ─── Profile API ──────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => apiFetch<{ profile: UserProfile | null }>("/api/profile"),

  save: (data: { dailyTimeMinutes?: number; intensityLevel?: number }) =>
    apiFetch<{ profile: UserProfile }>("/api/profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),
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
  get: () => apiFetch<Stats>(`/api/stats?_t=${Date.now()}`),

  heatmap: (days = 90) => {
    const tz = new Date().getTimezoneOffset(); // minutes offset from UTC
    return apiFetch<{ heatmap: HeatmapDay[] }>(`/api/stats/heatmap?days=${days}&tz=${tz}&_t=${Date.now()}`);
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

// ─── Subscription API ─────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  status: "trialing" | "active" | "past_due" | "canceled" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  trialEligible?: boolean;
}

export interface SubscriptionDetails {
  managedExternally?: boolean;
  status: "trialing" | "active" | "past_due" | "canceled" | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  plan: {
    name: string;
    priceId: string;
    amount: number;
    interval: string;
  } | null;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  customerEmail?: string;
  invoices: {
    id: string;
    date: string | null;
    amount: number;
    currency: string;
    status: string | null;
    hostedUrl: string | null;
  }[];
  trialEligible?: boolean;
}

export const subscriptionApi = {
  status: () => apiFetch<SubscriptionStatus>("/api/subscription"),

  checkout: (plan: "monthly" | "yearly") =>
    apiFetch<{ url: string }>("/api/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  portal: () =>
    apiFetch<{ url: string }>("/api/subscription/portal", {
      method: "POST",
    }),

  details: () => apiFetch<SubscriptionDetails>("/api/subscription/details"),

  cancel: () =>
    apiFetch<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: string }>(
      "/api/subscription/cancel",
      { method: "POST" }
    ),

  reactivate: () =>
    apiFetch<{ cancelAtPeriodEnd: boolean; status: string }>(
      "/api/subscription/reactivate",
      { method: "POST" }
    ),

  updatePayment: () =>
    apiFetch<{ clientSecret: string }>("/api/subscription/update-payment", {
      method: "POST",
    }),

  confirmPaymentUpdate: (paymentMethodId: string) =>
    apiFetch<{ paymentMethod: SubscriptionDetails["paymentMethod"] }>(
      "/api/subscription/update-payment",
      { method: "PUT", body: JSON.stringify({ paymentMethodId }) }
    ),

  changePlan: (plan: "monthly" | "yearly") =>
    apiFetch<{ plan: SubscriptionDetails["plan"]; status: string }>(
      "/api/subscription/change-plan",
      { method: "POST", body: JSON.stringify({ plan }) }
    ),
};

// ─── Account API ──────────────────────────────────────────────────────────────

export const accountApi = {
  delete: (password: string) =>
    apiFetch<{ success: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
};

// ─── Focus API ───────────────────────────────────────────────────────────────

export const focusApi = {
  get: (date?: string) => {
    const now = new Date();
    const localDate = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ focus: { focusGoalId: string } | null }>(`/api/focus?date=${localDate}`);
  },

  save: (focusGoalId: string) => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return apiFetch<{ focus: { focusGoalId: string } }>("/api/focus", {
      method: "POST",
      body: JSON.stringify({ focusGoalId, localDate }),
    });
  },
};

// ─── Notifications API ───────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  heading: string;
  subheading: string;
  linkUrl: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: () =>
    apiFetch<{ notifications: AppNotification[]; unreadCount: number }>(
      "/api/notifications"
    ),

  dismiss: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/notifications/${id}/dismiss`, {
      method: "POST",
    }),
};

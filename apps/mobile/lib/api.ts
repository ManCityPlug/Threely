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

export interface SubscriptionStatus {
  status: "trialing" | "active" | "past_due" | "canceled" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
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
  name: string | null;
  raw_reply: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 45_000;
const AUTH_TIMEOUT_MS = 10_000;

const AI_PATHS = [
  "/api/goals/parse",
  "/api/goals/chat",
  "/api/tasks/generate",
];

function isAiPath(path: string): boolean {
  return AI_PATHS.some((p) => path.startsWith(p));
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const sessionPromise = supabase.auth.getSession();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Auth session retrieval timed out")), AUTH_TIMEOUT_MS)
  );

  const {
    data: { session },
  } = await Promise.race([sessionPromise, timeoutPromise]);

  if (!session) throw new Error("Not authenticated");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

// ─── Token refresh coordination ──────────────────────────────────────────────
// If several in-flight requests all hit a 401 at once, we only want a single
// refresh call to run. Subsequent callers await the same promise.
let refreshInFlight: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      await supabase.auth.refreshSession();
    } catch {
      // Swallow here; the caller will re-check the session and fail loudly
      // if it's truly gone.
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// Sentinel marker so the caller-facing throw can be recognized by the app
// layout (which already listens for auth-related error strings).
const AUTH_EXPIRED_MESSAGE = "Unauthorized";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeoutMs = isAiPath(path) ? AI_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  // Each attempt builds its own controller/timeout so the retry has a fresh
  // clock and the original abort/timeout bookkeeping is self-contained.
  const attempt = async (): Promise<{ res: Response; text: string }> => {
    const headers = await getAuthHeaders();

    const controller = new AbortController();
    // If the caller already provided a signal (e.g. for unmount cancellation),
    // forward its abort to our internal controller so both can cancel the request.
    if (options.signal) {
      const externalSignal = options.signal;
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
        signal: controller.signal,
      });
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        // Distinguish caller-initiated cancellation from timeout
        if (options.signal?.aborted) {
          throw new Error("Request was cancelled");
        }
        throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      }
      throw new Error("Network error: unable to reach the server");
    }

    // Keep the timeout running while we read the response body — a slow body
    // stream could otherwise hang the app indefinitely.
    let text: string;
    try {
      text = await res.text();
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
      }
      throw new Error("Network error: connection lost while reading response");
    } finally {
      clearTimeout(timeoutId);
    }

    return { res, text };
  };

  let { res, text } = await attempt();

  // On 401, try to refresh the Supabase session once and retry the request
  // with the fresh token. If the second attempt is also unauthorized, bubble
  // up a recognizable error so the caller (typically the app's auth listener)
  // can decide whether to redirect to login.
  if (res.status === 401) {
    await refreshOnce();

    // Confirm we actually got a new session before wasting a retry on a
    // guaranteed 401. If the refresh itself failed (e.g. the refresh token
    // is expired), bail out immediately with the auth-expired signal.
    const { data: { session: refreshed } } = await supabase.auth.getSession();
    if (!refreshed) {
      throw new Error(AUTH_EXPIRED_MESSAGE);
    }

    // Note: POST/PATCH bodies on `options` are strings in this codebase
    // (JSON.stringify), so they're safe to reuse across attempts. If a caller
    // ever passes a ReadableStream body, the retry here would fail — none do today.
    ({ res, text } = await attempt());

    if (res.status === 401) {
      throw new Error(AUTH_EXPIRED_MESSAGE);
    }
  }

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
      onboarding?: boolean;
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

  chat: (messages: GoalChatMessage[], opts?: { onboarding?: boolean }) =>
    apiFetch<GoalChatResult>("/api/goals/chat", {
      method: "POST",
      body: JSON.stringify({ messages, onboarding: opts?.onboarding }),
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
      onboarding?: boolean;
      localDate?: string;
    }
  ) => {
    const now = new Date();
    const defaultLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const { localDate: overrideLocalDate, ...rest } = options ?? {};
    const localDate = overrideLocalDate ?? defaultLocalDate;
    return apiFetch<{ dailyTasks: DailyTask[]; coachNote?: string; restDay?: boolean }>("/api/tasks/generate", {
      method: "POST",
      body: JSON.stringify({ goalId, localDate, ...rest }),
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
      body: JSON.stringify({
        taskItemId,
        action: "reschedule",
        localDate: new Date().toLocaleDateString("en-CA"),
      }),
    }),

  editItem: (dailyTaskId: string, taskItemId: string, editData: { task?: string; description?: string }) =>
    apiFetch<{ dailyTask: DailyTask }>(`/api/tasks/${dailyTaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ taskItemId, action: "edit", editData }),
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

export const statsApi = {
  get: () => apiFetch<Stats>(`/api/stats?localDate=${new Date().toLocaleDateString("en-CA")}&_t=${Date.now()}`),

  heatmap: (days = 90) => {
    const tz = new Date().getTimezoneOffset(); // minutes offset from UTC
    return apiFetch<{ heatmap: HeatmapDay[] }>(`/api/stats/heatmap?days=${days}&tz=${tz}&_t=${Date.now()}`);
  },
};

// ─── Account API ──────────────────────────────────────────────────────────────

export const accountApi = {
  delete: (password: string) =>
    apiFetch<{ success: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
};

// ─── Subscription API ─────────────────────────────────────────────────────────

export interface SubscriptionDetails {
  managedExternally?: boolean;
  status: SubscriptionStatus["status"];
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

// ─── Subscription API ─────────────────────────────────────────────────────────

export const subscriptionApi = {
  status: () => apiFetch<SubscriptionStatus>("/api/subscription"),

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

  changePlan: (plan: "monthly" | "yearly") =>
    apiFetch<{ plan: SubscriptionDetails["plan"]; status: string }>(
      "/api/subscription/change-plan",
      { method: "POST", body: JSON.stringify({ plan }) }
    ),
};

// ─── Offers API ──────────────────────────────────────────────────────────────

export interface UserOffer {
  id: string;
  type: "discount_percent" | "discount_amount" | "free_month" | "pause";
  value: number;
  duration: "once" | "repeating";
  durationMonths: number;
  description: string;
  mode: "manual" | "auto";
  status: "pending" | "claimed" | "expired" | "auto_applied" | "revoked";
  expiresAt: string;
  claimedAt: string | null;
  createdAt: string;
}

export const offersApi = {
  me: () => apiFetch<{ offer: UserOffer | null }>("/api/offers/me"),

  claim: (offerId: string) =>
    apiFetch<{ success: boolean; details: unknown; description: string }>(
      "/api/offers/claim",
      { method: "POST", body: JSON.stringify({ offerId }) }
    ),
};

// ─── DFY API ──────────────────────────────────────────────────────────────────

export interface DfyProductImage { variant: string; url: string; alt: string }
export interface DfyProduct {
  id: string;
  title: string;
  niches: string[];
  supplier_cost: number;
  suggested_retail: number;
  why_it_sells: string;
  tags: string[];
  image_variants: DfyProductImage[];
}
export interface DfyLogo {
  pngBase64: string;
  svg: string;
  iconId: string;
  paletteId: string;
  fontId: string;
}

export const dfyApi = {
  names: (keyword: string, count = 5) =>
    apiFetch<{ names: string[] }>("/api/dfy/names", {
      method: "POST",
      body: JSON.stringify({ keyword, count }),
    }),

  products: (niches?: string[], count = 3, exclude_ids?: string[]) =>
    apiFetch<{ products: DfyProduct[] }>("/api/dfy/products", {
      method: "POST",
      body: JSON.stringify({ niches, count, exclude_ids }),
    }),

  logo: (businessName: string, batch = true) =>
    apiFetch<{ logo?: DfyLogo; logos?: DfyLogo[] }>("/api/dfy/logo", {
      method: "POST",
      body: JSON.stringify({ businessName, batch }),
    }),
};

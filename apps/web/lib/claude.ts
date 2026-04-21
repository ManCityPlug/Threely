// Threely no longer calls LLMs at runtime. All task content now comes from
// the pre-written path library in @threely/tasks. This file is kept only so
// the remaining type imports keep working — no network calls, no API keys.
//
// Historical note: functions named `parseGoal`, `generateTasks`, `goalChat`,
// and `generateRoadmap` used to wrap DeepSeek + Gemini. They now return
// static placeholders since the library handles everything the LLM used to.

// ─── Shared types (still used by API routes + clients) ──────────────────────

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
  name: string | null;
  raw_reply: string;
}

export interface UserProfileContext {
  dailyTimeMinutes: number;
  intensityLevel: number;
}

export interface GoalContext {
  id: string;
  title: string;
  rawInput: string;
  structuredSummary: string | null;
  category: string | null;
  deadline: Date | null;
  createdAt: Date;
  roadmap: string | null;
}

export interface ThemeEntry {
  date: string;
  themes: string[];
  difficultyRating: string;
}

export interface CoachingContext {
  v: 1;
  completionRate: number;
  difficultyTrend: string;
  avgTasksPerDay: number;
  streak: number;
  lastDifficulty: string;
  lastCompletion: string;
  lastNote: string | null;
  patterns: string | null;
  sessionsAnalyzed: number;
  lastUpdated: string;
  recent_task_themes?: ThemeEntry[];
}

export interface GenerateTasksInput {
  goal: GoalContext;
  profile: UserProfileContext;
  daysActive: number;
  tasksCompletedTotal: number;
  coachingContext: CoachingContext | null;
  requestingAdditional?: boolean;
  focusShifted?: boolean;
  postReview?: boolean;
  timeOfDay?: "morning" | "afternoon" | "evening";
  carriedOverTasks?: { task: string; description: string; why: string }[];
  newTaskCount?: number;
  previousTasks?: { daysAgo: number; task: string; description: string; completed: boolean }[];
  goalCompletionStats?: { totalGenerated: number; totalCompleted: number; completionRate: number };
}

export interface GenerateTasksResult {
  tasks: TaskItem[];
  coach_note?: string;
}

// ─── Stubs for legacy callers ────────────────────────────────────────────────
// Task content now lives in @threely/tasks. Goal titles come from the
// onboarding MC selector. Parsing free text is no longer needed because
// there is no free text anywhere in the product.

export async function parseGoal(rawInput: string, _userId?: string): Promise<ParsedGoal> {
  const trimmed = rawInput.trim();
  const short = trimmed.length > 25 ? trimmed.slice(0, 25) : trimmed;
  return {
    short_title: short || "My Goal",
    structured_summary: trimmed,
    category: "other",
    deadline_detected: null,
    daily_time_detected: null,
    work_days_detected: null,
    needs_more_context: false,
    recommendations: null,
  };
}

export async function generateTasks(_input: GenerateTasksInput & { userId?: string }): Promise<GenerateTasksResult> {
  // Replaced by the library-based /api/tasks/generate endpoint. Left as a
  // stub so any stray imports don't crash the build.
  return { tasks: [], coach_note: undefined };
}

export async function generateRoadmap(_input: {
  title: string;
  rawInput: string;
  structuredSummary: string | null;
  category: string | null;
  deadline: Date | null;
  dailyTimeMinutes: number;
  intensityLevel: number;
}, _userId?: string): Promise<string> {
  return ""; // Library paths have their own built-in progression
}

export async function goalChat(_messages: GoalChatMessage[], _userId?: string, _userName?: string | null): Promise<GoalChatResult> {
  return {
    message: "",
    options: [],
    done: true,
    goal_text: null,
    name: null,
    raw_reply: "",
  };
}

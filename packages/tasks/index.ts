import daytrading_beginner from "./daytrading_beginner.json";
import daytrading_experienced from "./daytrading_experienced.json";
import business_ecommerce from "./business_ecommerce.json";
import business_ecommerce_existing from "./business_ecommerce_existing.json";
import business_service from "./business_service.json";
import business_content from "./business_content.json";
import business_saas from "./business_saas.json";
import health_weight_loss from "./health_weight_loss.json";
import health_muscle from "./health_muscle.json";
import health_general from "./health_general.json";

export interface TaskVariant {
  position: number;
  minutes: number;
  variants: string[];
  why: string;
}

export interface TaskDay {
  day: number;
  minutes_total: number;
  tasks: TaskVariant[];
}

export interface TaskPath {
  path: string;
  category: string;
  display_name: string;
  goal_title_suggestions: string[];
  days: TaskDay[];
}

export const LIBRARIES: Record<string, TaskPath> = {
  daytrading_beginner: daytrading_beginner as TaskPath,
  daytrading_experienced: daytrading_experienced as TaskPath,
  business_ecommerce: business_ecommerce as TaskPath,
  business_ecommerce_existing: business_ecommerce_existing as TaskPath,
  business_service: business_service as TaskPath,
  business_content: business_content as TaskPath,
  business_saas: business_saas as TaskPath,
  health_weight_loss: health_weight_loss as TaskPath,
  health_muscle: health_muscle as TaskPath,
  health_general: health_general as TaskPath,
};

export type PathId = keyof typeof LIBRARIES;

export const PATH_IDS = Object.keys(LIBRARIES) as PathId[];

// Deterministic variant picker. Two users on the same day see different
// wording because userId is hashed into the selection — no state needed.
function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ResolvedTask {
  position: number;
  minutes: number;
  task: string;
  why: string;
}

export interface ResolvedDay {
  day: number;
  minutes_total: number;
  tasks: ResolvedTask[];
}

/** Return the 3 tasks for `dayNumber` of `pathId`, with variants chosen deterministically by `userId`. */
export function getTasksForDay(pathId: PathId, dayNumber: number, userId: string): ResolvedDay | null {
  const lib = LIBRARIES[pathId];
  if (!lib) return null;
  // Wrap past day 90 — users beyond the library get the cycle restart
  const idx = ((dayNumber - 1) % lib.days.length + lib.days.length) % lib.days.length;
  const day = lib.days[idx];
  if (!day) return null;
  return {
    day: dayNumber,
    minutes_total: day.minutes_total,
    tasks: day.tasks.map((t) => {
      const seed = `${userId}:${dayNumber}:${t.position}`;
      const variantIdx = hashStringToInt(seed) % t.variants.length;
      return {
        position: t.position,
        minutes: t.minutes,
        task: t.variants[variantIdx],
        why: t.why,
      };
    }),
  };
}

export function getPathMeta(pathId: PathId) {
  const lib = LIBRARIES[pathId];
  if (!lib) return null;
  return {
    path: lib.path,
    category: lib.category,
    display_name: lib.display_name,
    goal_title_suggestions: lib.goal_title_suggestions,
    total_days: lib.days.length,
  };
}

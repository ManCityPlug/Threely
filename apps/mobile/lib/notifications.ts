import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_TIME_KEY = "@threely_notif_time";
const SCHEDULE_COOLDOWN_KEY = "@threely_notif_last_scheduled";
const WEEKLY_WIN_KEY = "@threely_last_weekly_win";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotifTimePreference {
  hour: number;
  minute: number;
  label: string;
  time: string;
}

export interface NotifContext {
  focusGoalName: string | null;
  totalTimeMinutes: number;
  incompleteCount: number;
  allDone: boolean;
  staleGoals: { name: string; daysSince: number }[];
  isRestDay?: boolean;
  activeGoalCountToday: number;
  totalTimeAllGoals: number;
}

// ─── Notification identifiers ─────────────────────────────────────────────────

const ID_WEEKLY_CREATIVE = "threely-weekly-creative";
const ID_MILESTONE = "threely-milestone";
const ID_OPPORTUNITY = "threely-opportunity";
const ID_WEEKLY_WIN = "threely-weekly-win";
// Legacy identifiers — kept so cancelAllNotifications cleans old scheduled
// reminders from earlier app versions.
const ID_PRIMARY = "threely-primary";
const ID_EVENING = "threely-evening";

const COOLDOWN_MINUTES = 30;

// ─── Permission + preference helpers ──────────────────────────────────────────

export async function getNotifPreference(): Promise<NotifTimePreference | null> {
  try {
    const val = await AsyncStorage.getItem(NOTIF_TIME_KEY);
    return val ? (JSON.parse(val) as NotifTimePreference) : null;
  } catch {
    return null;
  }
}

export async function saveNotifPreference(
  pref: NotifTimePreference | null
): Promise<boolean> {
  if (!pref) {
    await AsyncStorage.removeItem(NOTIF_TIME_KEY);
    await cancelAllNotifications();
    return true;
  }
  await AsyncStorage.setItem(NOTIF_TIME_KEY, JSON.stringify(pref));
  const granted = await requestNotificationPermissions();
  if (granted) {
    await AsyncStorage.removeItem(SCHEDULE_COOLDOWN_KEY);
    return true;
  }
  return false;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ─── Legacy (kept as no-op for backward compat) ───────────────────────────────

export async function scheduleDailyReminder(_hour: number, _minute: number): Promise<void> {
  // No-op — daily nagging has been removed. See scheduleNotifications().
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelById(ID_PRIMARY);
  await cancelById(ID_EVENING);
  await cancelById(ID_WEEKLY_CREATIVE);
  await cancelById(ID_MILESTONE);
  await cancelById(ID_OPPORTUNITY);
  await cancelById(ID_WEEKLY_WIN);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // notification may not exist — safe to ignore
  }
}

async function isCooldownActive(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(SCHEDULE_COOLDOWN_KEY);
    if (!last) return false;
    const elapsed = (Date.now() - Number(last)) / (1000 * 60);
    return elapsed < COOLDOWN_MINUTES;
  } catch {
    return false;
  }
}

async function setCooldown(): Promise<void> {
  await AsyncStorage.setItem(SCHEDULE_COOLDOWN_KEY, String(Date.now()));
}

// ─── Main notification scheduling ─────────────────────────────────────────────

/**
 * Notification posture: subtle, value-driven, opt-in only.
 *
 * Default behavior (no user preference set): NOTHING fires. The app does not
 * nag. Retention comes from useful creatives, visible momentum, and curiosity
 * — not alarms.
 *
 * If the user has opted in by setting a time preference, a single low-key
 * "Win Reminder" fires at most once per week at their chosen time. Everything
 * else (weekly creative drops, milestone alerts, opportunity alerts) is
 * scheduled directly via the specific helpers below when those events occur.
 */
export async function scheduleNotifications(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;

  // Always cancel legacy daily reminders from prior app versions so returning
  // users stop getting nagged the first time they open the updated build.
  await cancelById(ID_PRIMARY);
  await cancelById(ID_EVENING);

  const pref = await getNotifPreference();
  // No preference = user hasn't opted in = silence. This is the default.
  if (!pref) return;

  if (await isCooldownActive()) return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await setCooldown();

  await maybeScheduleWeeklyWin(ctx, pref);
}

/**
 * Schedule the gentle weekly win reminder. Fires at most once per week. Copy
 * is framed around momentum, not chore completion.
 *
 * Called from scheduleNotifications() when the user has a time preference.
 */
async function maybeScheduleWeeklyWin(
  ctx: NotifContext,
  pref: NotifTimePreference,
): Promise<void> {
  // Skip if we already scheduled/fired within the past 6 days — never more
  // than once a week.
  try {
    const last = await AsyncStorage.getItem(WEEKLY_WIN_KEY);
    if (last) {
      const elapsedDays = (Date.now() - Number(last)) / (1000 * 60 * 60 * 24);
      if (elapsedDays < 6) return;
    }
  } catch {
    // proceed on storage failure
  }

  // Schedule for the user's chosen time on the next occurrence.
  const now = new Date();
  const fireTime = new Date(now);
  fireTime.setHours(pref.hour, pref.minute, 0, 0);
  if (now >= fireTime) fireTime.setDate(fireTime.getDate() + 1);

  await cancelById(ID_WEEKLY_WIN);
  await Notifications.scheduleNotificationAsync({
    identifier: ID_WEEKLY_WIN,
    content: {
      title: "Small moves compound",
      body: ctx.focusGoalName
        ? `Your next move on "${ctx.focusGoalName}" is waiting.`
        : "Your next move is waiting.",
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireTime,
    },
  });

  await AsyncStorage.setItem(WEEKLY_WIN_KEY, String(Date.now()));
}

// ─── Event-driven notifications (called when meaningful things happen) ────────

/**
 * Fire when the server has queued a fresh batch of weekly creatives.
 * Expected to be triggered by a server-side push, or by the client detecting
 * new items in the Creative Inbox. Always silent except for the badge.
 */
export async function notifyWeeklyCreativeDrop(): Promise<void> {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID_WEEKLY_CREATIVE,
    content: {
      title: "🎨 New creatives are ready",
      body: "Fresh ads and hooks just dropped in your inbox.",
      sound: false,
    },
    trigger: null,
  });
}

/**
 * Fire when a launch crosses a meaningful milestone (e.g. 80% launch ready,
 * first sale, 30 days active). Caller supplies the copy so this handler stays
 * dumb.
 */
export async function notifyMilestone(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `${ID_MILESTONE}-${Date.now()}`,
    content: { title, body, sound: false },
    trigger: null,
  });
}

/**
 * Fire when a specific high-value next action is ready for the user (e.g.
 * budget raise on a winning ad, a bundle opportunity based on conversion
 * data). Not a daily generic prompt — event-driven only.
 */
export async function notifyOpportunity(body: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: ID_OPPORTUNITY,
    content: {
      title: "Your next move is ready",
      body,
      sound: false,
    },
    trigger: null,
  });
}

/**
 * Replaces the old task-completion debounce. Now a no-op — we no longer
 * reschedule evening nudges when tasks get checked off. Kept as an export so
 * callers (e.g. the Today tab) don't crash; signature preserved.
 */
export function onTaskCompleted(_ctx: NotifContext): void {
  // Intentionally empty. See notification posture comment on
  // scheduleNotifications() for rationale.
}

/**
 * Send an immediate local notification. Skipped when app is in the
 * foreground. Reserved for event-driven callers (creative drop, milestone).
 */
export async function sendInstantNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (AppState.currentState === "active") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger: null,
  });
}

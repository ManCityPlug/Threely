import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_TIME_KEY = "@threely_notif_time";
const SCHEDULE_COOLDOWN_KEY = "@threely_notif_last_scheduled";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotifTimePreference {
  hour: number;
  minute: number;
  label: string;
  time: string; // e.g. "7:00 PM"
}

export interface NotifContext {
  focusGoalName: string | null;
  totalTimeMinutes: number;
  incompleteCount: number;
  allDone: boolean;
  staleGoals: { name: string; daysSince: number }[];
  isRestDay?: boolean;
}

// ─── Notification identifiers ─────────────────────────────────────────────────

const ID_PRIMARY = "threely-primary";
const ID_EVENING = "threely-evening";

// Default reminder time if user hasn't set a preference
const DEFAULT_HOUR = 8;
const DEFAULT_MINUTE = 0;

// Minimum minutes between re-scheduling calls to prevent spam
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
    // Clear cooldown so next scheduleNotifications() runs immediately
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

// ─── Legacy — kept for backward compat (saveNotifPreference still calls it) ──

export async function scheduleDailyReminder(_hour: number, _minute: number): Promise<void> {
  // No-op — scheduling is now handled entirely by scheduleNotifications()
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // notification may not exist — safe to ignore
  }
}

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Cooldown check ───────────────────────────────────────────────────────────

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
 * Schedule notifications for the daily focus goal only.
 *
 * Notifications (max 2/day):
 *  1. PRIMARY — at user's chosen time (default 8 AM). Focus goal tasks reminder.
 *  2. EVENING — at 8 PM, only if chosen time < 6 PM and tasks are incomplete.
 *
 * Has a 30-minute cooldown to prevent re-scheduling spam when state updates
 * rapidly (e.g. multiple task completions in quick succession).
 *
 * Always cancels ALL scheduled notifications first to prevent duplicates.
 */
export async function scheduleNotifications(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Cooldown — skip if we scheduled recently (prevents duplicate scheduling
  // from rapid state changes like multiple task completions)
  if (await isCooldownActive()) return;

  // Cancel ALL existing scheduled notifications to prevent duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Record cooldown timestamp
  await setCooldown();

  // Skip task notifications on rest days
  if (ctx.isRestDay) return;

  // Read user's preferred notification time
  const pref = await getNotifPreference();
  const prefHour = pref?.hour ?? DEFAULT_HOUR;
  const prefMinute = pref?.minute ?? DEFAULT_MINUTE;

  const goalName = ctx.focusGoalName ?? "your goals";
  const now = new Date();

  const todayAt = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // 1. PRIMARY reminder at user's chosen time — focus goal only
  const primaryTime = todayAt(prefHour, prefMinute);
  if (now < primaryTime) {
    const timeLabel = ctx.totalTimeMinutes > 0
      ? ` You have ${formatMin(ctx.totalTimeMinutes)} of tasks today.`
      : "";
    await Notifications.scheduleNotificationAsync({
      identifier: ID_PRIMARY,
      content: {
        title: `Time to work on "${goalName}"`,
        body: `Your daily tasks are waiting.${timeLabel}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: primaryTime,
      },
    });
  }

  // 2. EVENING nudge at 8 PM — only if primary time is before 6 PM and tasks incomplete
  const eveningTime = todayAt(20, 0);
  if (prefHour < 18 && now < eveningTime && !ctx.allDone && ctx.incompleteCount > 0) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_EVENING,
      content: {
        title: `You still have ${ctx.incompleteCount} task${ctx.incompleteCount > 1 ? "s" : ""} left`,
        body: `Finish strong on "${goalName}"!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: eveningTime,
      },
    });
  }
}

/**
 * Call after task completion to update evening notification.
 * Bypasses cooldown since this is a direct user action.
 */
export async function onTaskCompleted(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;

  // If all done, cancel evening nudge (no need to nag)
  if (ctx.allDone) {
    await cancelById(ID_EVENING);
    return;
  }

  // Update evening with new incomplete count
  const pref = await getNotifPreference();
  const prefHour = pref?.hour ?? DEFAULT_HOUR;

  // Only reschedule if primary time is before 6 PM
  if (prefHour >= 18) return;

  await cancelById(ID_EVENING);
  const now = new Date();
  const eveningTime = new Date(now);
  eveningTime.setHours(20, 0, 0, 0);

  if (now < eveningTime && ctx.incompleteCount > 0) {
    const goalName = ctx.focusGoalName ?? "your goals";
    await Notifications.scheduleNotificationAsync({
      identifier: ID_EVENING,
      content: {
        title: `You still have ${ctx.incompleteCount} task${ctx.incompleteCount > 1 ? "s" : ""} left`,
        body: `Finish strong on "${goalName}"!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: eveningTime,
      },
    });
  }
}

/**
 * Send an immediate local notification (e.g. when tasks finish generating).
 */
export async function sendInstantNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
}

// ─── Limited-user notification (free/limited plan) ────────────────────────────

const LIMITED_VARIANTS = [
  "Your 3 tasks are waiting — get Pro free to unlock daily AI plans",
  "Ready to crush today? Get Threely Pro free for 7 days",
  "Your goals aren't going to achieve themselves — unlock AI-powered tasks today",
  "Small steps, big results. Get Threely Pro free for personalized tasks",
];

const ID_LIMITED = "threely-limited";

/**
 * Schedule a single daily reminder for free/limited users
 * at their preferred time (default 9 AM) with rotating motivational copy.
 */
export async function scheduleNotificationsLimited(): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Cancel everything first to prevent duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  const pref = await getNotifPreference();
  const hour = pref?.hour ?? 9;
  const minute = pref?.minute ?? 0;

  const variant = LIMITED_VARIANTS[new Date().getDate() % LIMITED_VARIANTS.length];

  await Notifications.scheduleNotificationAsync({
    identifier: ID_LIMITED,
    content: {
      title: "Threely",
      body: variant,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

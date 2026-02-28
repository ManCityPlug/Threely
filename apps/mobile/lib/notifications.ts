import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_TIME_KEY = "@threely_notif_time";
const STALE_NOTIF_KEY = "@threely_stale_notif_";

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
  isRestDay?: boolean; // true if no goals are scheduled for today
}

// ─── Notification identifiers ─────────────────────────────────────────────────

const ID_MORNING = "threely-morning";
const ID_MIDDAY = "threely-midday";
const ID_EVENING = "threely-evening";

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
    await scheduleDailyReminder(pref.hour, pref.minute);
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

// ─── Legacy daily reminder (kept for backward compat) ─────────────────────────

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === "web") return;
  // Cancel only the old generic reminder, not our contextual ones
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time to work on your goals!",
      body: "Your 3 daily tasks are waiting for you.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Contextual notification scheduling ───────────────────────────────────────

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // notification may not exist — safe to ignore
  }
}

/**
 * Schedule all contextual notifications based on current app state.
 * Call this on app open, after task completion, and after goal focus change.
 */
export async function scheduleNotifications(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const goalName = ctx.focusGoalName ?? "your goals";

  // Cancel existing contextual notifications first
  await Promise.all([
    cancelById(ID_MORNING),
    cancelById(ID_MIDDAY),
    cancelById(ID_EVENING),
  ]);

  // Skip task notifications on rest days (no goals scheduled today)
  if (ctx.isRestDay) return;

  const now = new Date();
  const todayAt = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // 6a. Morning reminder (8:00 AM) — daily
  const morningTime = todayAt(8, 0);
  if (now < morningTime) {
    const timeLabel = ctx.totalTimeMinutes > 0
      ? ` You have ${formatMin(ctx.totalTimeMinutes)} of tasks today.`
      : "";
    await Notifications.scheduleNotificationAsync({
      identifier: ID_MORNING,
      content: {
        title: `Time to work on "${goalName}"!`,
        body: `Your daily tasks are waiting.${timeLabel}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: morningTime,
      },
    });
  }

  // 6b. Mid-day nudge (1:00 PM) — only if tasks are incomplete
  const middayTime = todayAt(13, 0);
  if (now < middayTime && !ctx.allDone && ctx.incompleteCount > 0) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_MIDDAY,
      content: {
        title: `Still have tasks on "${goalName}"`,
        body: "Keep going! You've got this.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: middayTime,
      },
    });
  }

  // 6c. Evening summary (8:00 PM)
  const eveningTime = todayAt(20, 0);
  if (now < eveningTime) {
    const title = ctx.allDone
      ? `Great job on "${goalName}"!`
      : `You still have ${ctx.incompleteCount} task${ctx.incompleteCount > 1 ? "s" : ""} left`;
    const body = ctx.allDone
      ? "You completed all your tasks today. Keep the streak going!"
      : `Finish strong on "${goalName}"!`;
    await Notifications.scheduleNotificationAsync({
      identifier: ID_EVENING,
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: eveningTime,
      },
    });
  }

  // 6d. Weekly stale goal nudge — one-time per stale goal per week
  for (const stale of ctx.staleGoals) {
    if (stale.daysSince < 7) continue;
    const staleKey = `${STALE_NOTIF_KEY}${stale.name}`;
    const lastNotified = await AsyncStorage.getItem(staleKey);
    if (lastNotified) {
      const daysSinceNotif = (Date.now() - Number(lastNotified)) / (1000 * 60 * 60 * 24);
      if (daysSinceNotif < 7) continue; // Don't re-notify within a week
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Haven't worked on "${stale.name}" in ${stale.daysSince} days`,
        body: "Ready to get back to it?",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: todayAt(10, 0) > now ? todayAt(10, 0) : new Date(now.getTime() + 60000),
      },
    });
    await AsyncStorage.setItem(staleKey, String(Date.now()));
  }
}

/**
 * Call after task completion to update mid-day/evening notifications.
 */
export async function onTaskCompleted(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;

  // If all done, cancel mid-day nudge and update evening to congrats
  if (ctx.allDone) {
    await cancelById(ID_MIDDAY);
  }

  // Reschedule evening with updated counts
  await cancelById(ID_EVENING);
  const now = new Date();
  const eveningTime = new Date(now);
  eveningTime.setHours(20, 0, 0, 0);
  if (now < eveningTime) {
    const goalName = ctx.focusGoalName ?? "your goals";
    const title = ctx.allDone
      ? `Great job on "${goalName}"!`
      : `You still have ${ctx.incompleteCount} task${ctx.incompleteCount > 1 ? "s" : ""} left`;
    const body = ctx.allDone
      ? "You completed all your tasks today. Keep the streak going!"
      : `Finish strong on "${goalName}"!`;
    await Notifications.scheduleNotificationAsync({
      identifier: ID_EVENING,
      content: { title, body, sound: true },
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

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

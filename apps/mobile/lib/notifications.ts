import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
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
  /** Number of goals that have tasks today (not off-day) */
  activeGoalCountToday: number;
  /** Total time across ALL active goals today */
  totalTimeAllGoals: number;
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
  await cancelById(ID_PRIMARY);
  await cancelById(ID_EVENING);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cancelById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // notification may not exist — safe to ignore
  }
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
 * Cancels existing notifications by ID before rescheduling to prevent duplicates.
 */
export async function scheduleNotifications(ctx: NotifContext): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Cooldown — skip if we scheduled recently (prevents duplicate scheduling
  // from rapid state changes like multiple task completions)
  if (await isCooldownActive()) return;

  // Cancel existing scheduled notifications by ID to prevent duplicates
  // (targeted cancellation avoids wiping unrelated notifications)
  await cancelById(ID_PRIMARY);
  await cancelById(ID_EVENING);

  // Record cooldown timestamp
  await setCooldown();

  // Skip ALL notifications if no goals are active today (all off-day)
  if (ctx.activeGoalCountToday === 0) return;

  // Read user's preferred notification time
  const pref = await getNotifPreference();
  const prefHour = pref?.hour ?? DEFAULT_HOUR;
  const prefMinute = pref?.minute ?? DEFAULT_MINUTE;

  const now = new Date();

  const todayAt = (h: number, m: number) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Build notification content based on active goal count
  const totalMin = ctx.totalTimeAllGoals;
  const timeStr = totalMin >= 60
    ? `${Math.floor(totalMin / 60)}h ${totalMin % 60 ? `${totalMin % 60}m` : ""}`
    : `${totalMin} min`;

  let primaryTitle: string;
  let primaryBody: string;
  if (ctx.activeGoalCountToday === 1) {
    primaryTitle = "Your tasks are ready";
    primaryBody = `${timeStr} today — let's go!`;
  } else {
    primaryTitle = "Your tasks are ready";
    primaryBody = `${timeStr} across ${ctx.activeGoalCountToday} goals today`;
  }

  // 1. PRIMARY reminder — recurring DAILY at user's chosen time
  //    Uses DAILY trigger so it fires every day even if the app isn't opened.
  await Notifications.scheduleNotificationAsync({
    identifier: ID_PRIMARY,
    content: {
      title: primaryTitle,
      body: primaryBody,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefHour,
      minute: prefMinute,
    },
  });

  // 2. EVENING nudge at 8 PM — only if primary time is before 6 PM and tasks incomplete
  const eveningTime = todayAt(20, 0);
  if (prefHour < 18 && now < eveningTime && !ctx.allDone && ctx.incompleteCount > 0) {
    await Notifications.scheduleNotificationAsync({
      identifier: ID_EVENING,
      content: {
        title: `You still have ${ctx.incompleteCount} task${ctx.incompleteCount > 1 ? "s" : ""} left`,
        body: "Finish strong — you're almost there!",
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
 * Debounced (3 s) so rapid toggling doesn't spam cancel+reschedule cycles.
 */
let _taskCompletedTimer: ReturnType<typeof setTimeout> | null = null;

export function onTaskCompleted(ctx: NotifContext): void {
  if (Platform.OS === "web") return;

  // If all done, cancel evening nudge immediately (no need to nag)
  if (ctx.allDone) {
    if (_taskCompletedTimer) { clearTimeout(_taskCompletedTimer); _taskCompletedTimer = null; }
    cancelById(ID_EVENING);
    return;
  }

  // Debounce: wait 3 s before rescheduling so rapid completions coalesce
  if (_taskCompletedTimer) clearTimeout(_taskCompletedTimer);
  _taskCompletedTimer = setTimeout(async () => {
    _taskCompletedTimer = null;
    try {
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
    } catch {
      // safe to ignore — notification scheduling is best-effort
    }
  }, 3000);
}

/**
 * Send an immediate local notification (e.g. when tasks finish generating).
 * Skips when the app is in the foreground — the user is already looking at
 * the result, so a banner is just noise.
 */
export async function sendInstantNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  // Don't fire while the user is actively in the app
  if (AppState.currentState === "active") return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
}


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

/**
 * Convert a local date (year, month 1-indexed, day) in a given IANA timezone
 * to its UTC equivalent at midnight of that local date.
 * E.g. Monday midnight CST (UTC-6) → Monday 06:00 UTC.
 */
function localMidnightToUTC(y: number, m: number, d: number, tz: string): Date {
  // Use noon UTC as a reference point to compute the timezone offset
  // (noon avoids edge cases where the offset itself crosses midnight)
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(noonUTC);
  const localHour = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const localMinute = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  // Offset in minutes = local time at noon UTC − 720 minutes
  const offsetMinutes = (localHour * 60 + localMinute) - 720;
  // UTC midnight for local midnight = subtract the offset
  return new Date(Date.UTC(y, m - 1, d, 0, -offsetMinutes, 0));
}

/**
 * Compute the most recent Monday at 00:00 in the given IANA timezone,
 * relative to "now". All returned Dates are proper UTC equivalents of
 * local-midnight Mondays.
 */
function getWeekBoundaries(tz: string) {
  // Current local date parts in the user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDateStr = formatter.format(now); // "YYYY-MM-DD"
  const [y, m, d] = localDateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d); // used only for day-of-week calc

  // Day of week: 0=Sun, 1=Mon, ...
  const dow = localDate.getDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;

  // This week's Monday date
  const mondayDate = new Date(localDate);
  mondayDate.setDate(mondayDate.getDate() - daysSinceMonday);
  const mY = mondayDate.getFullYear();
  const mM = mondayDate.getMonth() + 1;
  const mD = mondayDate.getDate();

  // Convert each Monday to the correct UTC timestamp for local midnight
  const thisMonday = localMidnightToUTC(mY, mM, mD, tz);
  const previousWeekStart = localMidnightToUTC(mY, mM, mD - 7, tz);
  const nextWeekStart = localMidnightToUTC(mY, mM, mD + 7, tz);

  return {
    thisMonday,        // Start of current (in-progress) week
    previousWeekStart, // Start of the completed week (summary candidate)
    nextWeekStart,     // When the next summary unlocks
  };
}

// GET /api/summary/weekly-status?tz=America/New_York
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tz = searchParams.get("tz") || "UTC";

    const { thisMonday, previousWeekStart, nextWeekStart } = getWeekBoundaries(tz);

    // Check if user even has data from the previous week
    const previousWeekEnd = new Date(thisMonday); // Sunday end = this Monday start
    const hasData = await prisma.dailyTask.count({
      where: {
        userId: user.id,
        date: { gte: previousWeekStart, lt: previousWeekEnd },
      },
    });

    if (hasData === 0) {
      // No activity last week — show locked with countdown to next Monday
      return NextResponse.json({
        status: "locked",
        unlocksAt: nextWeekStart.toISOString(),
      });
    }

    // Look up existing frozen summary
    const existing = await prisma.weeklySummary.findUnique({
      where: {
        userId_weekStart: { userId: user.id, weekStart: previousWeekStart },
      },
    });

    if (!existing) {
      // Week has data but no summary generated yet → ready to open
      return NextResponse.json({
        status: "ready",
        weekStart: previousWeekStart.toISOString(),
      });
    }

    // Summary exists — check if it's been opened
    if (!existing.firstOpenedAt) {
      // Generated but never opened (shouldn't normally happen, but handle it)
      return NextResponse.json({
        status: "available",
        summary: {
          ...existing.stats as object,
          insight: existing.insight,
        },
      });
    }

    // Check if firstOpenedAt is today in the user's timezone
    const openedFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const openedDateStr = openedFormatter.format(existing.firstOpenedAt);
    const todayStr = openedFormatter.format(new Date());

    if (openedDateStr === todayStr) {
      // Opened today — still available for re-reading
      return NextResponse.json({
        status: "available",
        summary: {
          ...existing.stats as object,
          insight: existing.insight,
        },
      });
    }

    // Opened on a past day — expired, show countdown for next week
    return NextResponse.json({
      status: "expired",
      unlocksAt: nextWeekStart.toISOString(),
    });
  } catch (e) {
    console.error("[/api/summary/weekly-status]", e);
    return NextResponse.json({ error: "Failed to check weekly status" }, { status: 500 });
  }
}

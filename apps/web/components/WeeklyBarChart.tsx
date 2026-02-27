"use client";

import { useMemo, useState } from "react";
import type { HeatmapDay } from "@/lib/api-client";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_HEIGHT = 120;

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun — use UTC to match server dates
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function WeeklyBarChart({ data }: { data: HeatmapDay[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0]; // UTC to match server
  }, []);

  const weekDates = useMemo(() => getWeekDates(), []);

  const dateMap = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const d of data) {
      map.set(d.date.slice(0, 10), d);
    }
    return map;
  }, [data]);

  const weekData = useMemo(() => {
    return weekDates.map((dateStr, i) => {
      const entry = dateMap.get(dateStr);
      const isFuture = dateStr > todayStr;
      return {
        dateStr,
        label: DAY_LABELS[i],
        completed: entry?.completed ?? 0,
        total: entry?.total ?? 0,
        isToday: dateStr === todayStr,
        isFuture,
      };
    });
  }, [weekDates, dateMap, todayStr]);

  // Weekly totals — denominator rounds up to next batch of 3
  const weekCompleted = weekData.reduce((s, d) => s + d.completed, 0);
  const weekDisplayTotal = weekCompleted === 0 ? 3 : Math.ceil(weekCompleted / 3) * 3;

  // Find the max total for any single day this week (for bar scaling)
  const maxDayTotal = Math.max(...weekData.map(d => d.total), 3);

  return (
    <div>
      {/* Week summary */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 16,
      }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--subtext)" }}>
          This week
        </span>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--primary)" }}>
          {weekCompleted}/{weekDisplayTotal} tasks
        </span>
      </div>

      {/* Bars */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        height: BAR_HEIGHT,
        marginBottom: 8,
      }}>
        {weekData.map((day, i) => {
          const dayMax = day.total > 0 ? day.total : maxDayTotal;
          const fillRatio = day.isFuture ? 0 : Math.min(day.completed / dayMax, 1);
          const fillHeight = Math.max(fillRatio * BAR_HEIGHT, fillRatio > 0 ? 8 : 0);
          const emptyHeight = BAR_HEIGHT - fillHeight;
          const isSelected = selectedDay === i;

          return (
            <div
              key={day.dateStr}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative",
                cursor: day.isFuture ? "default" : "pointer",
              }}
              onClick={() => {
                if (day.isFuture) return;
                setSelectedDay(isSelected ? null : i);
              }}
            >
              {/* Tooltip when clicked */}
              {isSelected && !day.isFuture && (
                <div style={{
                  position: "absolute",
                  top: Math.max(emptyHeight - 28, 0),
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--primary)",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  whiteSpace: "nowrap",
                  zIndex: 10,
                }}>
                  {day.completed}/{day.total} done
                </div>
              )}

              {/* Count label above bar */}
              {!day.isFuture && day.completed > 0 && !isSelected && (
                <div style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: day.isToday ? "var(--primary)" : "var(--subtext)",
                  marginBottom: 4,
                  position: "absolute",
                  top: emptyHeight - 18,
                }}>
                  {day.completed}
                </div>
              )}

              {/* Bar */}
              <div style={{
                width: "100%",
                maxWidth: 40,
                height: fillHeight || 4,
                borderRadius: 6,
                background: day.isFuture
                  ? "var(--border)"
                  : day.completed === 0
                    ? "var(--border)"
                    : day.completed >= day.total && day.total > 0
                      ? "var(--primary)"
                      : "rgba(99,91,255,0.4)",
                transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                opacity: day.isFuture ? 0.3 : 1,
                border: day.isToday || isSelected ? "1.5px solid var(--primary)" : "none",
              }} />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div style={{
        display: "flex",
        gap: 6,
      }}>
        {weekData.map((day, i) => (
          <div
            key={day.dateStr}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.7rem",
              fontWeight: day.isToday || selectedDay === i ? 700 : 500,
              color: day.isToday || selectedDay === i ? "var(--primary)" : "var(--muted)",
            }}
          >
            {day.label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        marginTop: 12,
        fontSize: "0.65rem",
        color: "var(--muted)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(99,91,255,0.4)" }} />
          <span>Partial</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--primary)" }} />
          <span>All done</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { HeatmapDay } from "@/lib/api-client";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_MAX = 3;
const BAR_HEIGHT = 120;

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }
  return dates;
}

export default function WeeklyBarChart({ data }: { data: HeatmapDay[] }) {
  const todayStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
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

  // Calculate the week's summary
  const weekCompleted = weekData.reduce((s, d) => s + d.completed, 0);
  const weekTotal = weekData.reduce((s, d) => s + d.total, 0);

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
          {weekCompleted}/{weekTotal} tasks
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
        {weekData.map((day) => {
          const fillRatio = day.isFuture ? 0 : Math.min(day.completed / BAR_MAX, 1);
          const fillHeight = Math.max(fillRatio * BAR_HEIGHT, fillRatio > 0 ? 8 : 0);
          const emptyHeight = BAR_HEIGHT - fillHeight;

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
              }}
            >
              {/* Count label above bar */}
              {!day.isFuture && day.completed > 0 && (
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
                    : day.isToday
                      ? "var(--primary)"
                      : day.completed >= BAR_MAX
                        ? "var(--primary)"
                        : "rgba(99,91,255,0.4)",
                transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                opacity: day.isFuture ? 0.3 : 1,
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
        {weekData.map((day) => (
          <div
            key={day.dateStr}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.7rem",
              fontWeight: day.isToday ? 700 : 500,
              color: day.isToday ? "var(--primary)" : "var(--muted)",
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
          <span>All 3 done</span>
        </div>
      </div>
    </div>
  );
}

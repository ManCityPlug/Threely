"use client";

import { useMemo, useState } from "react";
import type { HeatmapDay } from "@/lib/api-client";

function getColor(percentage: number): string {
  if (percentage === 0) return "var(--border)";
  if (percentage <= 25) return "rgba(99,91,255,0.2)";
  if (percentage <= 50) return "rgba(99,91,255,0.4)";
  if (percentage <= 75) return "rgba(99,91,255,0.65)";
  return "var(--primary)";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

export default function CalendarHeatmap({
  data,
}: {
  data: HeatmapDay[];
  weeks?: number;
}) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const isCurrentMonth = isSameMonth(currentMonth, today);

  // Build date -> HeatmapDay map
  const dateMap = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const d of data) {
      map.set(d.date.slice(0, 10), d);
    }
    return map;
  }, [data]);

  // Build calendar grid
  const grid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const rows: {
      day: number | null;
      dateStr: string;
      heatmap: HeatmapDay | null;
      isToday: boolean;
      isFuture: boolean;
    }[][] = [];
    let row: typeof rows[0] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      row.push({ day: null, dateStr: "", heatmap: null, isToday: false, isFuture: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayDate = new Date(year, month, d);
      const isFuture = dayDate > today;
      row.push({
        day: d,
        dateStr,
        heatmap: dateMap.get(dateStr) ?? null,
        isToday: dateStr === todayStr,
        isFuture,
      });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }

    if (row.length > 0) {
      while (row.length < 7) {
        row.push({ day: null, dateStr: "", heatmap: null, isToday: false, isFuture: false });
      }
      rows.push(row);
    }

    return rows;
  }, [currentMonth, dateMap, today]);

  function navigateMonth(delta: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div>
      {/* Month navigation */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            width: 30,
            height: 30,
            cursor: "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text)",
          }}
        >
          {"\u2039"}
        </button>
        <span style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          color: "var(--text)",
        }}>
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          disabled={isCurrentMonth}
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            width: 30,
            height: 30,
            cursor: isCurrentMonth ? "default" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text)",
            opacity: isCurrentMonth ? 0.3 : 1,
          }}
        >
          {"\u203A"}
        </button>
      </div>

      {/* Day-of-week labels */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 3,
        marginBottom: 3,
      }}>
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              fontSize: "0.65rem",
              fontWeight: 500,
              color: "var(--muted)",
              padding: "2px 0",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {grid.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 3,
            }}
          >
            {row.map((cell, ci) => {
              if (cell.day === null) {
                return <div key={ci} />;
              }

              const pct = cell.heatmap?.percentage ?? 0;
              const bg = cell.isFuture ? "transparent" : getColor(pct);
              const tooltip = cell.isFuture
                ? ""
                : cell.heatmap
                  ? `${cell.dateStr}: ${cell.heatmap.completed}/${cell.heatmap.total} (${cell.heatmap.percentage}%)`
                  : `${cell.dateStr}: no tasks`;

              return (
                <div
                  key={ci}
                  title={tooltip}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: cell.isToday ? 700 : 500,
                    color: cell.isFuture
                      ? "var(--muted)"
                      : cell.isToday
                        ? "var(--primary)"
                        : pct > 50
                          ? "#fff"
                          : "var(--subtext)",
                    boxShadow: cell.isToday ? "inset 0 0 0 2px var(--primary)" : undefined,
                    transition: "background-color 0.2s",
                    cursor: cell.isFuture ? "default" : "pointer",
                  }}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

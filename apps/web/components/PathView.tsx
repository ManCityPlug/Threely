"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathViewProps {
  dayNumber: number;
  completedDays: number;
  onDayClick: (day: number, type: "completed" | "today" | "next" | "locked") => void;
  allDoneToday: boolean;
  totalTasks: number;
  onStartDay?: () => void;
  tasksVisible?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_DAYS = [7, 14, 30, 60, 100];
const GOLD = "#D4A843";
const GOLD_DIM = "rgba(212,168,67,0.35)";
const GREY = "rgba(255,255,255,0.25)";
const GREY_NODE = "rgba(255,255,255,0.10)";

// Desktop constants
const DESKTOP_NODE_SIZE = 64;
const DESKTOP_TODAY_SIZE = 72;
const DESKTOP_MILESTONE_SIZE = 68;
const DESKTOP_CROWN_SIZE = 72;
const DESKTOP_DAYS_VISIBLE = 7;

// Mobile constants
const MOBILE_NODE_SIZE = 56;
const MOBILE_TODAY_SIZE = 72;
const MOBILE_MILESTONE_SIZE = 62;
const MOBILE_CROWN_SIZE = 66;
const MOBILE_ZIGZAG = 90;
const MOBILE_SPACING = 135;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PathView({
  dayNumber,
  completedDays,
  onDayClick,
  allDoneToday,
  totalTasks,
  onStartDay,
  tasksVisible,
}: PathViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [containerWidth, setContainerWidth] = useState(400);
  const [todayPopup, setTodayPopup] = useState(false);
  const [lockedModal, setLockedModal] = useState(false);

  // Calculate which days to show
  // Desktop: show current week (7 days, starting from the nearest week boundary)
  // Mobile: show up to 20 days in a vertical zigzag
  const MOBILE_VISIBLE_NODES = 20;

  const desktopWeekStart = Math.max(1, Math.floor((dayNumber - 1) / 7) * 7 + 1);
  const mobileWindowStart = Math.max(1, dayNumber - Math.min(dayNumber - 1, 7));

  const desktopDays: number[] = [];
  for (let i = 0; i < DESKTOP_DAYS_VISIBLE; i++) {
    desktopDays.push(desktopWeekStart + i);
  }

  const mobileDays: number[] = [];
  for (let i = 0; i < MOBILE_VISIBLE_NODES; i++) {
    mobileDays.push(mobileWindowStart + i);
  }

  const days = isDesktop ? desktopDays : mobileDays;
  const lastVisibleDay = days[days.length - 1];

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll today into view (mobile: vertical, desktop: horizontal)
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      if (todayRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const node = todayRef.current;
        if (isDesktop) {
          const containerRect = container.getBoundingClientRect();
          const scrollTarget = node.offsetLeft - containerRect.width / 2 + 36;
          container.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
        } else {
          const containerRect = container.getBoundingClientRect();
          const scrollTarget = node.offsetTop - containerRect.height / 2 + 36;
          container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mounted, isDesktop]);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      setIsDesktop(w >= 900);
      if (scrollRef.current) {
        setContainerWidth(scrollRef.current.clientWidth);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close today popup on outside click
  useEffect(() => {
    if (!todayPopup) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-today-popup]") && !target.closest("[data-today-node]")) {
        setTodayPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [todayPopup]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getNodeType = useCallback(
    (day: number): "completed" | "today" | "next" | "locked" => {
      if (day < dayNumber) return "completed";
      if (day === dayNumber) return "today";
      if (day === dayNumber + 1 && allDoneToday) return "next";
      return "locked";
    },
    [dayNumber, allDoneToday]
  );

  function isMilestone(day: number): boolean {
    return MILESTONE_DAYS.includes(day);
  }

  function isCrownNode(day: number): boolean {
    return day === lastVisibleDay;
  }

  function getNodeSize(day: number): number {
    if (isDesktop) {
      if (day === dayNumber) return DESKTOP_TODAY_SIZE;
      if (isCrownNode(day)) return DESKTOP_CROWN_SIZE;
      if (isMilestone(day)) return DESKTOP_MILESTONE_SIZE;
      return DESKTOP_NODE_SIZE;
    }
    if (day === dayNumber) return MOBILE_TODAY_SIZE;
    if (isCrownNode(day)) return MOBILE_CROWN_SIZE;
    if (isMilestone(day)) return MOBILE_MILESTONE_SIZE;
    return MOBILE_NODE_SIZE;
  }

  function handleNodeClick(day: number, nodeType: "completed" | "today" | "next" | "locked") {
    if (nodeType === "today") {
      if (tasksVisible) {
        onDayClick(day, nodeType);
        return;
      }
      setTodayPopup((prev) => !prev);
      return;
    }
    if (nodeType === "locked") {
      setLockedModal(true);
      return;
    }
    onDayClick(day, nodeType);
  }

  // ─── Mobile: vertical zigzag layout helpers ───────────────────────────────

  const centerX = containerWidth / 2;

  function getMobileNodeX(index: number): number {
    const dir = index % 2 === 0 ? 1 : -1;
    return centerX + dir * MOBILE_ZIGZAG;
  }

  function getMobileNodeY(index: number): number {
    return 50 + index * MOBILE_SPACING;
  }

  // ─── Render node icon ─────────────────────────────────────────────────────

  function renderNodeIcon(day: number, nodeType: string, size: number) {
    const crown = isCrownNode(day);
    const milestone = isMilestone(day);

    if (crown) {
      return <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{"\uD83D\uDC51"}</span>;
    }

    if (nodeType === "completed" && milestone) {
      return <span style={{ fontSize: size * 0.4, lineHeight: 1 }}>{"\uD83C\uDFC6"}</span>;
    }

    if (nodeType === "completed") {
      return (
        <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
          <path d="M3 7L6 10L11 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (nodeType === "today" && milestone) {
      return <span style={{ fontSize: size * 0.4, lineHeight: 1 }}>{"\u2B50"}</span>;
    }

    if (nodeType === "today") {
      if (allDoneToday) {
        return (
          <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 14 14" fill="none">
            <path d="M3 7L6 10L11 4" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      }
      return (
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill={GOLD} stroke="none">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    }

    if ((nodeType === "locked" || nodeType === "next") && milestone) {
      return <span style={{ fontSize: size * 0.36, lineHeight: 1, opacity: 0.5 }}>{"\uD83C\uDFC6"}</span>;
    }

    // Locked / next: lock icon
    return (
      <svg
        width={size * 0.28}
        height={size * 0.28}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }

  // ─── Node style builder ───────────────────────────────────────────────────

  function getNodeStyle(day: number, nodeType: string, size: number): React.CSSProperties {
    const crown = isCrownNode(day);

    const base: React.CSSProperties = {
      width: size,
      height: size,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: 0,
      flexShrink: 0,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative",
      outline: "none",
    };

    if (crown) {
      return {
        ...base,
        border: `2.5px solid ${GOLD_DIM}`,
        background: "rgba(212,168,67,0.12)",
        animation: "crownShimmer 4s ease-in-out infinite",
        boxShadow: "0 0 20px 6px rgba(212,168,67,0.25), 0 0 50px 12px rgba(212,168,67,0.08)",
      };
    }

    if (nodeType === "completed") {
      return {
        ...base,
        border: "none",
        background: `linear-gradient(145deg, ${GOLD}, #C49A3C)`,
        boxShadow: "0 4px 16px rgba(212,168,67,0.3), 0 1px 4px rgba(0,0,0,0.2)",
      };
    }

    if (nodeType === "today") {
      return {
        ...base,
        border: `3px solid ${GOLD}`,
        background: "rgba(212,168,67,0.10)",
        animation: "breatheGlow 3s ease-in-out infinite",
        boxShadow: "0 0 20px 4px rgba(212,168,67,0.3)",
      };
    }

    if (nodeType === "next") {
      return {
        ...base,
        border: `2.5px dashed ${GOLD_DIM}`,
        background: "rgba(212,168,67,0.06)",
        opacity: 0.85,
      };
    }

    // locked
    return {
      ...base,
      border: `2px solid ${GREY}`,
      background: GREY_NODE,
      opacity: 0.4,
    };
  }

  // ─── Label renderer ───────────────────────────────────────────────────────

  function renderLabel(day: number, nodeType: string, position: "below" | "side", isRight?: boolean) {
    const crown = isCrownNode(day);
    const milestone = isMilestone(day);

    const align = position === "below" ? "center" : isRight ? "flex-start" : "flex-end";
    const textAlign = position === "below" ? ("center" as const) : isRight ? ("left" as const) : ("right" as const);

    const wrapper: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: align,
      whiteSpace: "nowrap",
      marginTop: position === "below" ? 10 : 0,
    };

    if (crown) {
      return (
        <div style={wrapper}>
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 800,
              color: GOLD,
              letterSpacing: "-0.01em",
              textAlign,
            }}
          >
            Huge Progress
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: GOLD,
              opacity: 0.8,
              textAlign,
            }}
          >
            Keep going!
          </span>
        </div>
      );
    }

    if (nodeType === "today") {
      return (
        <div style={wrapper}>
          <span
            style={{
              fontSize: position === "below" ? "0.88rem" : "1rem",
              fontWeight: 800,
              color: GOLD,
              letterSpacing: "-0.02em",
              textAlign,
            }}
          >
            Day {day}
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: allDoneToday ? GOLD : "rgba(255,255,255,0.9)",
              marginTop: 2,
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              textAlign,
            }}
          >
            {allDoneToday ? "Complete!" : "TODAY"}
          </span>
        </div>
      );
    }

    if (nodeType === "completed") {
      return (
        <div style={wrapper}>
          <span
            style={{
              fontSize: position === "below" ? "0.82rem" : "0.88rem",
              fontWeight: 700,
              color: GOLD,
              textAlign,
            }}
          >
            Day {day}
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: GOLD,
              opacity: 0.75,
              textAlign,
            }}
          >
            {milestone ? "Milestone!" : "Complete!"}
          </span>
        </div>
      );
    }

    if (milestone) {
      return (
        <div style={wrapper}>
          <span
            style={{
              fontSize: position === "below" ? "0.82rem" : "0.88rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              textAlign,
            }}
          >
            Day {day}
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              textAlign,
            }}
          >
            Milestone
          </span>
        </div>
      );
    }

    if (nodeType === "next" && allDoneToday) {
      return (
        <div style={wrapper}>
          <span
            style={{
              fontSize: position === "below" ? "0.82rem" : "0.88rem",
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              textAlign,
            }}
          >
            Day {day}
          </span>
        </div>
      );
    }

    // Locked
    return (
      <div style={wrapper}>
        <span
          style={{
            fontSize: position === "below" ? "0.78rem" : "0.82rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            textAlign,
          }}
        >
          Day {day}
        </span>
      </div>
    );
  }

  // ─── Today popup ──────────────────────────────────────────────────────────

  function renderTodayPopup(day: number, popupPosition: "above" | "side", isRight?: boolean) {
    if (day !== dayNumber || !todayPopup || allDoneToday) return null;

    const popupStyle: React.CSSProperties =
      popupPosition === "above"
        ? {
            position: "absolute",
            bottom: "calc(100% + 16px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            animation: "popupFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }
        : {
            position: "absolute",
            top: -10,
            ...(isRight ? { left: "calc(100% + 16px)" } : { right: "calc(100% + 16px)" }),
            zIndex: 100,
            animation: "popupFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          };

    // Arrow points toward node
    const arrowStyle: React.CSSProperties =
      popupPosition === "above"
        ? {
            position: "absolute",
            bottom: -8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "9px solid rgba(30,28,24,0.97)",
            filter: `drop-shadow(0 1px 0 ${GOLD})`,
          }
        : isRight
        ? {
            position: "absolute",
            top: 20,
            left: -8,
            width: 0,
            height: 0,
            borderTop: "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderRight: "9px solid rgba(30,28,24,0.97)",
            filter: `drop-shadow(-1px 0 0 ${GOLD})`,
          }
        : {
            position: "absolute",
            top: 20,
            right: -8,
            width: 0,
            height: 0,
            borderTop: "9px solid transparent",
            borderBottom: "9px solid transparent",
            borderLeft: "9px solid rgba(30,28,24,0.97)",
            filter: `drop-shadow(1px 0 0 ${GOLD})`,
          };

    return (
      <div data-today-popup="true" style={popupStyle}>
        <div
          style={{
            background: "rgba(30,28,24,0.97)",
            border: `1.5px solid ${GOLD}`,
            borderRadius: 16,
            padding: "20px 28px",
            textAlign: "center",
            minWidth: 190,
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(212,168,67,0.08)`,
            position: "relative",
          }}
        >
          <div style={arrowStyle} />
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            Day {day}
          </div>
          <div
            style={{
              fontSize: "0.84rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              marginBottom: 16,
            }}
          >
            {totalTasks} tasks ready
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTodayPopup(false);
              if (onStartDay) onStartDay();
              onDayClick(day, "today");
            }}
            style={{
              width: "100%",
              padding: "11px 24px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${GOLD}, #C49A3C)`,
              color: "#000",
              fontSize: "0.92rem",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "filter 0.2s, transform 0.2s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.12)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            START
          </button>
        </div>
      </div>
    );
  }

  // ─── Desktop layout: horizontal row ───────────────────────────────────────

  function renderDesktop() {
    return (
      <div
        ref={scrollRef}
        className="path-scroll"
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          padding: "40px 0 30px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-evenly",
            minWidth: "100%",
            padding: "0 40px",
            gap: 12,
          }}
        >
          {days.map((day, i) => {
            const nodeType = getNodeType(day);
            const size = getNodeSize(day);
            const crown = isCrownNode(day);

            return (
              <div
                key={day}
                ref={day === dayNumber ? todayRef : undefined}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  opacity: mounted ? 1 : 0,
                  animation: mounted ? `nodeEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.06}s both` : "none",
                  zIndex: nodeType === "today" ? 10 : crown ? 5 : 1,
                  position: "relative",
                }}
              >
                {/* Subtle dot connector between nodes (not on last) */}
                {i < days.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: size / 2 - 1,
                      left: `calc(50% + ${size / 2 + 8}px)`,
                      right: `-${size / 2 + 8}px`,
                      height: 2,
                      background:
                        nodeType === "completed" && getNodeType(days[i + 1]) !== "locked"
                          ? `linear-gradient(to right, ${GOLD}, rgba(212,168,67,0.3))`
                          : `linear-gradient(to right, rgba(255,255,255,0.08), rgba(255,255,255,0.04))`,
                      borderRadius: 1,
                      pointerEvents: "none",
                      opacity: 0.6,
                    }}
                  />
                )}

                <button
                  data-today-node={day === dayNumber ? "true" : undefined}
                  onClick={() => handleNodeClick(day, nodeType)}
                  className="path-node-btn"
                  style={getNodeStyle(day, nodeType, size)}
                  aria-label={crown ? "Huge Progress" : `Day ${day}`}
                >
                  {renderNodeIcon(day, nodeType, size)}
                </button>

                {renderLabel(day, nodeType, "below")}

                {/* Today popup: appears ABOVE node on desktop */}
                {renderTodayPopup(day, "above")}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Mobile layout: vertical zigzag ───────────────────────────────────────

  function renderMobile() {
    return (
      <div
        ref={scrollRef}
        className="path-scroll"
        style={{
          position: "relative",
          width: "100%",
          maxHeight: 520,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: days.length * MOBILE_SPACING + 80,
          }}
        >
          {/* Subtle curved path connectors */}
          {mounted && (
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              {days.slice(0, -1).map((day, i) => {
                const nextDay = days[i + 1];
                const size1 = getNodeSize(day);
                const size2 = getNodeSize(nextDay);
                const x1 = getMobileNodeX(i);
                const y1 = getMobileNodeY(i) + size1 / 2;
                const x2 = getMobileNodeX(i + 1);
                const y2 = getMobileNodeY(i + 1) + size2 / 2;

                const nodeType = getNodeType(day);
                const nextNodeType = getNodeType(nextDay);
                const isGold = nodeType === "completed" && (nextNodeType === "completed" || nextNodeType === "today");

                // Cubic bezier for a smooth S-curve
                const cpY = (y1 + y2) / 2;

                return (
                  <path
                    key={`curve-${day}`}
                    d={`M ${x1} ${y1} C ${x1} ${cpY}, ${x2} ${cpY}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isGold ? GOLD : "rgba(255,255,255,0.08)"}
                    strokeWidth={isGold ? 2 : 1.5}
                    strokeDasharray={isGold ? "none" : "6 6"}
                    opacity={isGold ? 0.5 : 0.4}
                  />
                );
              })}
            </svg>
          )}

          {/* Nodes */}
          {days.map((day, i) => {
            const nodeType = getNodeType(day);
            const crown = isCrownNode(day);
            const size = getNodeSize(day);
            const xPos = getMobileNodeX(i);
            const yPos = getMobileNodeY(i);
            const isRight = i % 2 === 0;

            return (
              <div
                key={day}
                ref={day === dayNumber ? todayRef : undefined}
                style={{
                  position: "absolute",
                  top: yPos,
                  left: xPos,
                  transform: "translate(-50%, 0)",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexDirection: isRight ? "row" : "row-reverse",
                  opacity: mounted ? 1 : 0,
                  animation: mounted ? `nodeEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.05}s both` : "none",
                  zIndex: nodeType === "today" ? 10 : crown ? 5 : 1,
                }}
              >
                <div style={{ position: "relative" }}>
                  <button
                    data-today-node={day === dayNumber ? "true" : undefined}
                    onClick={() => handleNodeClick(day, nodeType)}
                    className="path-node-btn"
                    style={getNodeStyle(day, nodeType, size)}
                    aria-label={crown ? "Huge Progress" : `Day ${day}`}
                  >
                    {renderNodeIcon(day, nodeType, size)}
                  </button>

                  {/* Today popup: side on mobile */}
                  {renderTodayPopup(day, "side", isRight)}
                </div>

                {renderLabel(day, nodeType, "side", isRight)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes breatheGlow {
          0%, 100% { box-shadow: 0 0 20px 4px rgba(212,168,67,0.3); }
          50% { box-shadow: 0 0 40px 12px rgba(212,168,67,0.5); }
        }

        @keyframes crownShimmer {
          0%, 100% {
            box-shadow: 0 0 20px 6px rgba(212,168,67,0.25), 0 0 50px 12px rgba(212,168,67,0.08);
            border-color: rgba(212,168,67,0.35);
          }
          50% {
            box-shadow: 0 0 30px 10px rgba(212,168,67,0.4), 0 0 70px 20px rgba(212,168,67,0.12);
            border-color: rgba(212,168,67,0.55);
          }
        }

        @keyframes nodeEnter {
          from {
            opacity: 0;
            transform: ${isDesktop ? "translateY(12px) scale(0.9)" : "translateY(12px) scale(0.9)"};
          }
          to {
            opacity: 1;
            transform: ${isDesktop ? "translateY(0) scale(1)" : "translate(-50%, 0) scale(1)"};
          }
        }

        @keyframes popupFadeIn {
          from { opacity: 0; transform: translateY(6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .path-scroll::-webkit-scrollbar { display: none; }
        .path-node-btn {
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .path-node-btn:hover {
          filter: brightness(1.1);
          transform: scale(1.06);
        }
        .path-node-btn:active {
          transform: scale(0.97);
        }
      `}</style>

      {isDesktop ? renderDesktop() : renderMobile()}

      {/* Locked day modal */}
      {lockedModal && (
        <div
          onClick={() => setLockedModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "modalFadeIn 0.2s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(30,28,24,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "32px 28px 28px",
              width: "calc(100vw - 2rem)",
              maxWidth: 380,
              textAlign: "center",
              animation: "modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.65,
                marginBottom: 24,
                margin: "0 0 24px",
              }}
            >
              This day hasn&apos;t been unlocked yet. Complete the previous day to continue.
            </p>
            <button
              onClick={() => setLockedModal(false)}
              style={{
                padding: "13px 40px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${GOLD}, #C49A3C)`,
                color: "#000",
                fontSize: "0.92rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "filter 0.2s, transform 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.12)";
                e.currentTarget.style.transform = "scale(1.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

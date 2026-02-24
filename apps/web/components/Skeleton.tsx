"use client";

export function SkeletonLine({
  height = 14,
  width = "100%",
}: {
  height?: number | string;
  width?: number | string;
}) {
  return (
    <div
      className="skeleton"
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        borderRadius: "var(--radius-sm)",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="card"
      style={{
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="90%" height={12} />
      <SkeletonLine width="40%" height={12} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <SkeletonLine width={60} height={28} />
      <SkeletonLine width={80} height={12} />
    </div>
  );
}

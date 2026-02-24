import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f6f9fc",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "#635bff", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, margin: "0 auto 1.5rem",
        }}>3</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#0a2540", marginBottom: 8 }}>
          404
        </h1>
        <p style={{ color: "#425466", marginBottom: "1.5rem" }}>
          This page doesn't exist.
        </p>
        <Link href="/" style={{
          display: "inline-block",
          padding: "0.65rem 1.5rem",
          background: "#635bff",
          color: "#fff",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: "0.9rem",
        }}>
          Go home
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0a",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <img src="/favicon.png" alt="Threely" width={52} height={52} style={{ borderRadius: 14, margin: "0 auto 1.5rem", display: "block" }} />
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#e8e8e8", marginBottom: 8 }}>
          404
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>
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

import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Start Free Trial | Threely",
  description: "3 tasks. Every day. Actually done. Start your 7-day free trial.",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Override body/html background so no white bleeds through the gradient */}
      <style>{`
        html { height: 100% !important; }
        body {
          margin: 0 !important;
          padding: 0 !important;
          min-height: 100% !important;
          background: #1A1040 !important;
        }
        .start-gradient-wrapper {
          position: fixed;
          inset: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .start-logo-img { width: 36px; height: 36px; border-radius: 10px; }
        .start-logo-text { font-size: 1.1rem; }
        .start-header { padding: 20px 0 0; gap: 10px; }
        @media (min-width: 768px) {
          .start-logo-img { width: 48px; height: 48px; border-radius: 13px; }
          .start-logo-text { font-size: 1.4rem; }
          .start-header { padding: 32px 0 0; gap: 12px; }
        }
      `}</style>
      <div
        className="start-gradient-wrapper"
        style={{
          background: "linear-gradient(180deg, #1A1040 0%, #2D1B69 50%, #635BFF 100%)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          WebkitFontSmoothing: "antialiased",
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
        }}
      >
        {/* Minimal logo header */}
        <header
          className="start-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            className="start-logo-img"
            src="/favicon.png"
            alt="Threely"
          />
          <span
            className="start-logo-text"
            style={{
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            Threely
          </span>
        </header>

        {children}
      </div>
    </>
  );
}

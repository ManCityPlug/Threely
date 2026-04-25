export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { background: #141414 !important; }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.setAttribute('data-theme','dark');` }} />
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141414",
        padding: "1rem",
      }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {children}
        </div>
      </div>
    </>
  );
}

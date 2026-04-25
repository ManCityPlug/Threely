"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

export function AuthDivider() {
  return (
    <div className="auth-divider">
      <span>or</span>
    </div>
  );
}

export function SocialAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleOAuth(provider: "google" | "apple") {
    setLoadingProvider(provider);
    setError("");

    const supabase = getSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoadingProvider(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        className="btn btn-social btn-google"
        disabled={loadingProvider !== null}
        onClick={() => handleOAuth("google")}
      >
        {loadingProvider === "google" ? (
          <span className="spinner spinner-dark" />
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </button>

      <button
        type="button"
        className="btn btn-social btn-apple"
        disabled={loadingProvider !== null}
        onClick={() => handleOAuth("apple")}
      >
        {loadingProvider === "apple" ? (
          <span className="spinner" />
        ) : (
          <>
            <AppleIcon />
            Continue with Apple
          </>
        )}
      </button>

      {error && (
        <div style={{
          background: "var(--danger-light)", color: "var(--danger)",
          padding: "0.65rem 0.875rem", borderRadius: "var(--radius)",
          fontSize: "0.875rem",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

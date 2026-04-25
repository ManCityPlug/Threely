"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase-client";
import { isOnboarded, markOnboarded } from "@/lib/auth-context";
import { profileApi } from "@/lib/api-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up forgot-password cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Show error banner if redirected from failed OAuth
    if (searchParams.get("error") === "auth") {
      setError("Sign-in failed. Please try again.");
    }
    // Redirect if already logged in
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [searchParams, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Always show a generic error — we don't expose account existence
      // to prevent enumeration attacks.
      setLoading(false);
      setError("Invalid login credentials");
      return;
    }
    if (data.session && data.user) {
      // Fast path: localStorage knows they're onboarded
      if (isOnboarded(data.user.id)) {
        // Full page load ensures cookies are synced with middleware
        window.location.href = "/dashboard";
        return;
      }
      // Slow path: check DB for existing profile
      try {
        const { profile } = await profileApi.get();
        if (profile) {
          markOnboarded(data.user.id);
        }
        // Returning user on login page — always go to dashboard
        // (layout will redirect to onboarding if truly needed)
        window.location.href = "/dashboard";
      } catch {
        // Even on error, try dashboard — layout handles the auth gate
        window.location.href = "/dashboard";
      }
    } else {
      setLoading(false);
      setError("Sign-in failed. Please try again.");
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const supabase = getSupabase();
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
    });
    setForgotLoading(false);
    setForgotSent(true);
    setForgotCooldown(60);
    if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
    forgotTimerRef.current = setInterval(() => {
      setForgotCooldown((prev) => {
        if (prev <= 1) {
          if (forgotTimerRef.current) {
            clearInterval(forgotTimerRef.current);
            forgotTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleForgotResend() {
    setForgotLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail.trim() }),
    });
    setForgotLoading(false);
    setForgotCooldown(60);
    if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
    forgotTimerRef.current = setInterval(() => {
      setForgotCooldown((prev) => {
        if (prev <= 1) {
          if (forgotTimerRef.current) {
            clearInterval(forgotTimerRef.current);
            forgotTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <>
      <Card className="w-full border-neutral-200 p-8 shadow-sm">
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="inline-block text-base font-bold tracking-tight text-neutral-900"
          >
            Threely
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-neutral-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Sign in to your Threely account
          </p>
        </div>

        <SocialAuthButtons />

        <AuthDivider />

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" variant="gold" size="lg" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          {showMagicLink ? (
            <div className="mt-2">
              <MagicLinkForm />
              <button
                type="button"
                onClick={() => setShowMagicLink(false)}
                className="mt-3 text-xs text-neutral-500 hover:text-neutral-900"
              >
                Back to password sign in
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMagicLink(true)}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Sign in with a magic link instead
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-neutral-900 hover:underline">
            Sign up
          </Link>
        </p>
      </Card>

      <p className="mt-6 text-center text-xs text-neutral-500">
        &copy; {new Date().getFullYear()} Threely. All rights reserved.
      </p>

      {/* Forgot password overlay */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
          onClick={() => setShowForgotPassword(false)}
        >
          <Card
            className="w-full max-w-sm border-neutral-200 p-8 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {forgotSent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-xl font-bold text-gold">
                  ✓
                </div>
                <h2 className="text-lg font-bold text-neutral-900">Check your email</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  We sent a password reset link to{" "}
                  <strong className="font-semibold text-neutral-900">{forgotEmail}</strong>. Click the link to set a new password.
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  Not seeing it? Check your spam folder.
                </p>
                <Button
                  type="button"
                  variant="gold"
                  size="lg"
                  disabled={forgotCooldown > 0 || forgotLoading}
                  onClick={handleForgotResend}
                  className="mt-5 w-full"
                >
                  {forgotLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : forgotCooldown > 0 ? (
                    `Resend in ${forgotCooldown}s`
                  ) : (
                    "Resend reset link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                    setForgotEmail("");
                    setForgotCooldown(0);
                  }}
                  className="mt-2 w-full"
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-neutral-900">Reset your password</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
                <form onSubmit={handleForgotSubmit} className="mt-5 flex flex-col gap-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-neutral-700">
                      Email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoComplete="email"
                      required
                      autoFocus
                      className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="gold" size="lg" disabled={forgotLoading} className="flex-1">
                      {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send link"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

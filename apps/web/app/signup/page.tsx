"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase-client";
import { SocialAuthButtons, AuthDivider } from "@/components/SocialAuthButtons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromStart = searchParams.get("from") === "start";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAnon, setIsAnon] = useState(false);

  // Detect anonymous session — if anon, we convert instead of creating new
  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.is_anonymous) {
        setIsAnon(true);
      } else if (session?.user && !session.user.is_anonymous) {
        // Already a real user — go to dashboard
        router.replace("/dashboard");
      }
    })();
  }, [router]);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabase();

      if (isAnon) {
        // Convert anon user to real user — same user ID, all data persists
        const { error: updateError } = await supabase.auth.updateUser({ email, password });
        if (updateError) {
          throw new Error(
            updateError.message.includes("already")
              ? "An account with this email already exists."
              : updateError.message
          );
        }
        // Card already captured → go to dashboard
        router.push("/dashboard?subscribed=1");
        return;
      }

      // Regular signup flow
      const res = await fetch("/api/start/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Account created but sign-in failed. Please try again.");

      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
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
            {fromStart || isAnon ? "Save your plan" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            {fromStart || isAnon
              ? "Free account. No credit card required."
              : "Start your free account"}
          </p>
        </div>

        <SocialAuthButtons />

        <AuthDivider />

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-neutral-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-neutral-900 hover:underline">
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
          By continuing, you agree to our{" "}
          <a href="https://threely.co/terms" className="underline hover:text-neutral-700">
            Terms
          </a>{" "}
          and{" "}
          <a href="https://threely.co/privacy" className="underline hover:text-neutral-700">
            Privacy Policy
          </a>
          .
        </p>
      </Card>

      <p className="mt-6 text-center text-xs text-neutral-500">
        &copy; {new Date().getFullYear()} Threely. All rights reserved.
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

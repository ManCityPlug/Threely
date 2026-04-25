"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type") || "recovery";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <>
        <Card className="w-full border-neutral-200 p-8 text-center shadow-sm">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-block text-base font-bold tracking-tight text-neutral-900"
            >
              Threely
            </Link>
          </div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Invalid link
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            This password reset link is invalid. Please request a new one.
          </p>
          <Button
            variant="gold"
            size="lg"
            onClick={() => router.replace("/login")}
            className="mt-6 w-full"
          >
            Back to sign in
          </Button>
        </Card>
        <p className="mt-6 text-center text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirm) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <Card className="w-full border-neutral-200 p-8 text-center shadow-sm">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-block text-base font-bold tracking-tight text-neutral-900"
            >
              Threely
            </Link>
          </div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <CheckCircle2 className="h-6 w-6 text-gold" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Password updated
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Your password has been changed successfully.
          </p>
          <Button
            variant="gold"
            size="lg"
            onClick={() => router.replace("/login")}
            className="mt-6 w-full"
          >
            Sign in
          </Button>
        </Card>
        <p className="mt-6 text-center text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Threely. All rights reserved.
        </p>
      </>
    );
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
            Set new password
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Choose a new password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              New password
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
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-neutral-700">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-neutral-500">
        &copy; {new Date().getFullYear()} Threely. All rights reserved.
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

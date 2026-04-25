"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    const supabase = getSupabase();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
        <CheckCircle2 className="mb-2 h-5 w-5 text-emerald-600" />
        <p className="text-sm font-semibold text-neutral-900">
          Check your email
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          We sent a login link to <strong className="font-semibold text-neutral-900">{email}</strong>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-3 text-left">
      <div>
        <label htmlFor="magic-email" className="block text-sm font-medium text-neutral-700">
          Email
        </label>
        <input
          id="magic-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" variant="gold" size="lg" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send login link"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";

type Plan = "monthly" | "yearly";
type Tier = "standard" | "pro";

interface CheckoutButtonProps {
  plan: Plan;
  /** Tier to forward through to checkout. Defaults to "standard". */
  tier?: Tier;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CheckoutButton({ plan, tier = "standard", style, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    // Persist the selected tier so the /start funnel and checkout page can
    // pick it up if the user ends up bouncing through signup.
    try { localStorage.setItem("threely_pricing_tier", tier); } catch { /* ignore */ }

    // Check if user is authenticated — if not, redirect to welcome/signup
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/start";
      return;
    }

    setLoading(true);
    window.location.href = `/checkout?plan=${plan}&tier=${tier}`;
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        ...style,
        cursor: loading ? "wait" : "pointer",
        border: style?.border || "none",
      }}
    >
      {loading ? "Redirecting..." : children}
    </button>
  );
}

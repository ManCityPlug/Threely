"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase-client";

type Plan = "monthly" | "yearly";

interface CheckoutButtonProps {
  plan: Plan;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CheckoutButton({ plan, style, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    // Check if user is authenticated — if not, redirect to welcome/signup
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/welcome";
      return;
    }

    setLoading(true);
    window.location.href = `/checkout?plan=${plan}`;
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

export default function MarketingNav() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user && !session.user.is_anonymous) setLoggedIn(true);
      });
  }, []);

  const ctaHref = loggedIn ? "/dashboard" : "/start";
  const ctaLabel = loggedIn ? "Go to Dashboard" : "Start for $1";

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-neutral-900"
        >
          Threely
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!loggedIn && (
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Log In
            </Link>
          )}
          <Button asChild variant="gold" size="sm">
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md md:hidden"
        >
          <span className="block h-0.5 w-5 bg-neutral-900" />
          <span className="block h-0.5 w-5 bg-neutral-900" />
          <span className="block h-0.5 w-5 bg-neutral-900" />
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-neutral-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 p-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {link.label}
              </Link>
            ))}
            {!loggedIn && (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Log In
              </Link>
            )}
            <Button asChild variant="gold" size="lg" className="mt-2">
              <Link href={ctaHref} onClick={() => setMenuOpen(false)}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

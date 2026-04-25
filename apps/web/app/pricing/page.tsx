import type { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pick Standard or Pro. Start your business for $1 today, then $39/mo (Standard) or $79/mo (Pro) after your 3-day Launch Preview. Annual plans save up to $749/yr.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Threely Pricing — $1 Launch Preview",
    description: "Standard or Pro. Start for $1. Cancel anytime during your 3-day Launch Preview.",
  },
};

export default function PricingPage() {
  return <PricingPageClient />;
}

import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Request a full refund within 14 days of your first Threely charge — no questions asked. Email refund@threely.co.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      <MarketingNav />

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold">
            Legal
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-neutral-900 md:text-5xl">
            Refund Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-500">
            Last updated: February 28, 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          {/* Highlight box */}
          <div className="mb-10 rounded-lg border border-gold/30 bg-gold/10 p-6">
            <p className="text-base leading-relaxed text-neutral-800">
              Not happy with Threely? Email us at{" "}
              <a
                href="mailto:refund@threely.co"
                className="font-semibold text-neutral-900 underline underline-offset-2"
              >
                refund@threely.co
              </a>{" "}
              within <strong>14 days</strong> of your first paid charge for a
              full refund. No questions asked.
            </p>
          </div>

          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                14-Day Refund Window
              </h2>
              <p className="leading-relaxed text-neutral-700">
                If you are unsatisfied with Threely for any reason, you may
                request a full refund within 14 days of your first paid
                subscription charge. This applies to all plans — monthly and
                yearly.
              </p>
              <p className="leading-relaxed text-neutral-700">
                Refunds are not available after the 14-day window has passed.
                Your subscription start date is the date your first payment was
                charged, not the start of your free period.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                How to Request a Refund
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Send an email to{" "}
                <a
                  href="mailto:refund@threely.co"
                  className="font-medium text-neutral-900 underline underline-offset-2"
                >
                  refund@threely.co
                </a>{" "}
                with the email address associated with your Threely account.
                Include the reason for your refund request so we can improve.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                Processing Time
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Refunds are typically processed within 2–3 business days. The
                refund will be returned to the original payment method.
                Depending on your bank, it may take an additional 5–10 business
                days for the refund to appear on your statement.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                Cancellation
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You can cancel your subscription at any time from your profile
                settings in the app. When you cancel, you retain access to all
                paid features until the end of your current billing period. No
                further charges will be made after cancellation.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                Contact
              </h2>
              <p className="leading-relaxed text-neutral-700">
                For refund requests:{" "}
                <a
                  href="mailto:refund@threely.co"
                  className="font-medium text-neutral-900 underline underline-offset-2"
                >
                  refund@threely.co
                </a>
              </p>
              <p className="leading-relaxed text-neutral-700">
                For general support:{" "}
                <a
                  href="mailto:support@threely.co"
                  className="font-medium text-neutral-900 underline underline-offset-2"
                >
                  support@threely.co
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

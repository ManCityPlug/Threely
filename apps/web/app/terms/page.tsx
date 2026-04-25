import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Threely Terms of Service. Read about account usage, subscriptions, cancellation, AI-generated content, and your rights.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "February 28, 2026";

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-neutral-500">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <p className="mb-10 leading-relaxed text-neutral-700">
            These Terms of Service (&quot;Terms&quot;) govern your access to and
            use of Threely (&quot;Service&quot;), including our website at
            threely.co and mobile applications. By creating an account or using
            the Service, you agree to be bound by these Terms.
          </p>

          <div className="space-y-10">
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                1. Account Registration
              </h2>
              <p className="leading-relaxed text-neutral-700">
                To use Threely, you must create an account with a valid email
                address and password. You are responsible for maintaining the
                security of your account credentials and for all activity that
                occurs under your account. You must be at least 13 years old to
                use the Service.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                2. Free Period and Subscriptions
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Threely offers Pro for $1 for 3 days with full access to all
                features. Payment details are securely collected when you sign
                up, and the $1 trial fee is charged at checkout.
              </p>
              <p className="leading-relaxed text-neutral-700">
                After the 3-day trial ends, continued access to AI-generated
                tasks and coaching features requires a paid subscription.
                Subscriptions are billed monthly or annually, depending on the
                plan you choose. Prices are displayed on our pricing page and
                may be updated with reasonable notice.
              </p>
              <p className="leading-relaxed text-neutral-700">
                Subscriptions automatically renew at the end of each billing
                period unless you cancel before the renewal date.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                3. Cancellation and Refunds
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You may cancel your subscription at any time from your account
                settings. Upon cancellation, you retain access to paid features
                until the end of your current billing period.
              </p>
              <p className="leading-relaxed text-neutral-700">
                If you are unsatisfied with the Service, you may request a full
                refund within 14 days of your first paid subscription charge.
                Refunds are not available after this 14-day window. To request
                a refund, email refund@threely.co with your account email.
                Refunds are typically processed within 2–3 business days.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                4. AI-Generated Content
              </h2>
              <p className="leading-relaxed text-neutral-700">
                Threely uses artificial intelligence to generate daily tasks,
                coaching insights, and goal analysis. This content is generated
                automatically based on the information you provide and is
                intended as guidance, not professional advice.
              </p>
              <p className="leading-relaxed text-neutral-700">
                AI-generated content may not always be accurate, complete, or
                suitable for your specific situation. Threely is not a
                substitute for professional coaching, medical advice, financial
                guidance, or any other professional service. Use your own
                judgment when following AI suggestions.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                5. Your Content
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You retain ownership of all content you provide to Threely,
                including your goals, reviews, notes, and feedback. By using
                the Service, you grant Threely a limited license to use this
                content solely to provide and improve the Service for you.
              </p>
              <p className="leading-relaxed text-neutral-700">
                We do not use your personal content to train AI models. Your
                data is used only to generate your personalized daily plans and
                coaching insights.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                6. Acceptable Use
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You agree not to use the Service to: violate any applicable law
                or regulation; impersonate any person or entity; attempt to
                gain unauthorized access to any part of the Service; interfere
                with the proper operation of the Service; or use automated
                means to access the Service without our permission.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                7. Service Availability
              </h2>
              <p className="leading-relaxed text-neutral-700">
                We strive to keep Threely available at all times, but we do not
                guarantee uninterrupted access. The Service may be temporarily
                unavailable due to maintenance, updates, or circumstances
                beyond our control. We will make reasonable efforts to provide
                advance notice of planned downtime.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                8. Account Termination
              </h2>
              <p className="leading-relaxed text-neutral-700">
                You may delete your account at any time from your profile
                settings. This permanently removes all your data, including
                goals, tasks, reviews, and personal information.
              </p>
              <p className="leading-relaxed text-neutral-700">
                We reserve the right to suspend or terminate accounts that
                violate these Terms or engage in abusive behavior, with notice
                where practical.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                9. Limitation of Liability
              </h2>
              <p className="leading-relaxed text-neutral-700">
                To the maximum extent permitted by law, Threely and its
                operators shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your
                use of the Service. Our total liability for any claim related
                to the Service shall not exceed the amount you paid for the
                Service in the 12 months preceding the claim.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                10. Changes to These Terms
              </h2>
              <p className="leading-relaxed text-neutral-700">
                We may update these Terms from time to time. If we make
                material changes, we will notify you via email or through the
                Service. Continued use of the Service after changes take effect
                constitutes acceptance of the updated Terms.
              </p>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                11. Contact
              </h2>
              <p className="leading-relaxed text-neutral-700">
                If you have questions about these Terms, contact us at
                support@threely.co.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

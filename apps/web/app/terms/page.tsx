import type { Metadata } from "next";
import MarketingNav from "@/components/MarketingNav";
import MarketingFooter from "@/components/MarketingFooter";

export const metadata: Metadata = {
  title: "Terms of Service — Threely",
  description:
    "Threely Terms of Service. Read about account usage, subscriptions, cancellation, AI-generated content, and your rights when using the Threely AI goal coaching platform.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "February 28, 2026";

export default function TermsPage() {
  const h2Style = {
    fontSize: "1.2rem" as const,
    fontWeight: 700 as const,
    letterSpacing: "-0.02em" as const,
    marginTop: "2.5rem" as const,
    marginBottom: "0.75rem" as const,
  };

  const pStyle = {
    fontSize: "0.925rem" as const,
    color: "#425466" as const,
    lineHeight: 1.75 as const,
    marginBottom: "0.75rem" as const,
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#0a2540", background: "#fff" }}>
      <MarketingNav />

      {/* Hero */}
      <section style={{
        background: "#f6f9fc",
        padding: "3.5rem 1.5rem 2.5rem",
        borderBottom: "1px solid #e3e8ef",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "0.5rem",
          }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#8898aa" }}>
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: "2.5rem 1.5rem 4rem" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          <p style={pStyle}>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Threely (&quot;Service&quot;), including our website at threely.co and mobile applications. By creating an account or using the Service, you agree to be bound by these Terms.
          </p>

          <h2 style={h2Style}>1. Account Registration</h2>
          <p style={pStyle}>
            To use Threely, you must create an account with a valid email address and password. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. You must be at least 13 years old to use the Service.
          </p>

          <h2 style={h2Style}>2. Free Trial and Subscriptions</h2>
          <p style={pStyle}>
            Threely offers a free 7-day trial that provides full access to all features. Payment details are securely collected when you start your trial, but you will not be charged until the trial period ends.
          </p>
          <p style={pStyle}>
            After the trial, continued access to AI-generated tasks and coaching features requires a paid subscription. Subscriptions are billed monthly or annually, depending on the plan you choose. Prices are displayed on our pricing page and may be updated with reasonable notice.
          </p>
          <p style={pStyle}>
            Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date.
          </p>

          <h2 style={h2Style}>3. Cancellation and Refunds</h2>
          <p style={pStyle}>
            You may cancel your subscription at any time from your account settings. Upon cancellation, you retain access to paid features until the end of your current billing period.
          </p>
          <p style={pStyle}>
            If you are unsatisfied with the Service, you may request a full refund within 7 days of your first paid subscription charge. Refunds are not available after this 7-day window. To request a refund, email refund@threely.co with your account email. Refunds are typically processed within 2–3 business days.
          </p>

          <h2 style={h2Style}>4. AI-Generated Content</h2>
          <p style={pStyle}>
            Threely uses artificial intelligence to generate daily tasks, coaching insights, and goal analysis. This content is generated automatically based on the information you provide and is intended as guidance, not professional advice.
          </p>
          <p style={pStyle}>
            AI-generated content may not always be accurate, complete, or suitable for your specific situation. Threely is not a substitute for professional coaching, medical advice, financial guidance, or any other professional service. Use your own judgment when following AI suggestions.
          </p>

          <h2 style={h2Style}>5. Your Content</h2>
          <p style={pStyle}>
            You retain ownership of all content you provide to Threely, including your goals, reviews, notes, and feedback. By using the Service, you grant Threely a limited license to use this content solely to provide and improve the Service for you.
          </p>
          <p style={pStyle}>
            We do not use your personal content to train AI models. Your data is used only to generate your personalized daily plans and coaching insights.
          </p>

          <h2 style={h2Style}>6. Acceptable Use</h2>
          <p style={pStyle}>
            You agree not to use the Service to: violate any applicable law or regulation; impersonate any person or entity; attempt to gain unauthorized access to any part of the Service; interfere with the proper operation of the Service; or use automated means to access the Service without our permission.
          </p>

          <h2 style={h2Style}>7. Service Availability</h2>
          <p style={pStyle}>
            We strive to keep Threely available at all times, but we do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We will make reasonable efforts to provide advance notice of planned downtime.
          </p>

          <h2 style={h2Style}>8. Account Termination</h2>
          <p style={pStyle}>
            You may delete your account at any time from your profile settings. This permanently removes all your data, including goals, tasks, reviews, and personal information.
          </p>
          <p style={pStyle}>
            We reserve the right to suspend or terminate accounts that violate these Terms or engage in abusive behavior, with notice where practical.
          </p>

          <h2 style={h2Style}>9. Limitation of Liability</h2>
          <p style={pStyle}>
            To the maximum extent permitted by law, Threely and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability for any claim related to the Service shall not exceed the amount you paid for the Service in the 12 months preceding the claim.
          </p>

          <h2 style={h2Style}>10. Changes to These Terms</h2>
          <p style={pStyle}>
            We may update these Terms from time to time. If we make material changes, we will notify you via email or through the Service. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
          </p>

          <h2 style={h2Style}>11. Contact</h2>
          <p style={pStyle}>
            If you have questions about these Terms, contact us at support@threely.co.
          </p>

        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

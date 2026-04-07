"use client";

import { useEffect, useMemo, useState } from "react";
import { subscriptionApi, type CancelReason, type SubscriptionDetails } from "@/lib/api-client";

// ─── Cancel flow modal with save offers ──────────────────────────────────────
//
// Step 1: Survey (always required)
// Step 2: Plan-specific save offer (yearly refund window or monthly retain offer)
// Step 3: Final confirmation
//
// Uses the dark theme + gold accent (#D4A843 / #B8862D gradient).

type Step = "survey" | "save" | "confirm" | "success" | "error";

const REASONS: { value: CancelReason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using it enough" },
  { value: "found_better", label: "Found something better" },
  { value: "just_trying", label: "Just trying it out" },
  { value: "other", label: "Other" },
];

const REFUND_WINDOW_DAYS = 14;
const SAVE_OFFER_THROTTLE_DAYS = 365;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export interface CancelModalProps {
  open: boolean;
  details: SubscriptionDetails;
  onClose: () => void;
  onCancelled: () => void;
  onPaused: () => void;
  onDiscountApplied: () => void;
}

export default function CancelModal({
  open,
  details,
  onClose,
  onCancelled,
  onPaused,
  onDiscountApplied,
}: CancelModalProps) {
  const [step, setStep] = useState<Step>("survey");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset everything when modal opens
  useEffect(() => {
    if (open) {
      setStep("survey");
      setReason(null);
      setFeedback("");
      setError(null);
      setSuccessMsg(null);
      setSubmitting(false);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const planName = (details.plan?.name ?? "Monthly").toLowerCase();
  const isYearly = planName === "yearly";

  // Refund eligibility (yearly + within 14 days of first paid charge)
  const firstPaidDays = daysSince(details.firstPaidAt ?? null);
  const refundEligible =
    isYearly && firstPaidDays !== null && firstPaidDays <= REFUND_WINDOW_DAYS;

  // Save offer eligibility — monthly users get one offer per year
  const lastSaveOfferDays = daysSince(details.lastSaveOfferAt ?? null);
  const saveOfferEligible =
    lastSaveOfferDays === null || lastSaveOfferDays > SAVE_OFFER_THROTTLE_DAYS;

  const periodEndStr = formatDate(details.currentPeriodEnd);
  const planAmount = details.plan?.amount ?? 0;
  const planDisplayAmount = useMemo(
    () => `$${(planAmount / 100).toFixed(2)}`,
    [planAmount]
  );

  // ── Step navigation ────────────────────────────────────────────────────────
  function handleSurveyContinue() {
    if (!reason) return;

    // Determine the next step based on plan + reason
    if (isYearly) {
      // Yearly: refund-or-period-end branch
      setStep("save");
      return;
    }

    // Monthly: skip the save offer entirely if we already used it within a year
    if (!saveOfferEligible) {
      setStep("confirm");
      return;
    }

    // Monthly: "found something better" — no save offer
    if (reason === "found_better") {
      setStep("confirm");
      return;
    }

    setStep("save");
  }

  // ── Stripe action handlers ────────────────────────────────────────────────
  async function handleApplyDiscount() {
    setSubmitting(true);
    setError(null);
    try {
      await subscriptionApi.applyDiscount({
        percent_off: 50,
        duration: "once",
      });
      setSuccessMsg("Discount applied — your next month will be 50% off.");
      setStep("success");
      onDiscountApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply discount");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePause() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await subscriptionApi.pause(30);
      const resumeStr = formatDate(res.pauseEndsAt);
      setSuccessMsg(`Your subscription is paused until ${resumeStr}.`);
      setStep("success");
      onPaused();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pause subscription");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmCancel(refund = false) {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await subscriptionApi.cancel({
        reason,
        feedback: feedback.trim() || undefined,
        refund,
      });
      if (res.refunded) {
        setSuccessMsg("Your subscription has been cancelled and your refund is on its way.");
      } else {
        setSuccessMsg(
          `Your subscription will end on ${formatDate(res.currentPeriodEnd ?? null)}. You'll keep full access until then.`
        );
      }
      setStep("success");
      onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel subscription");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // ── Subviews ───────────────────────────────────────────────────────────────
  const surveyView = (
    <>
      <ModalHeader title="We're sorry to see you go" subtitle="Help us understand what went wrong — it only takes a second." />

      <div className="cancel-reason-list">
        {REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`cancel-reason${reason === r.value ? " selected" : ""}`}
            onClick={() => setReason(r.value)}
          >
            <span className="cancel-reason-radio" aria-hidden>
              {reason === r.value && <span className="cancel-reason-radio-dot" />}
            </span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label
          htmlFor="cancel-feedback"
          style={{
            display: "block",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--subtext)",
            marginBottom: 6,
          }}
        >
          Anything else? (optional)
        </label>
        <textarea
          id="cancel-feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us what we could do better…"
          className="cancel-textarea"
        />
      </div>

      <div className="cancel-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Never mind
        </button>
        <button
          type="button"
          className="btn btn-gold"
          onClick={handleSurveyContinue}
          disabled={!reason}
        >
          Continue
        </button>
      </div>
    </>
  );

  const yearlySaveView = (
    <>
      {refundEligible ? (
        <>
          <ModalHeader
            title="You're still within your refund window"
            subtitle={`Yearly plans qualify for a full refund within ${REFUND_WINDOW_DAYS} days of purchase.`}
          />
          <div className="cancel-info">
            <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.5 }}>
              You can cancel right now and we'll issue a full refund of <strong>{planDisplayAmount}</strong> back to your original payment method. It typically takes 5–7 business days to appear on your statement.
            </p>
          </div>
          <div className="cancel-actions cancel-actions-stack">
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => handleConfirmCancel(true)}
              disabled={submitting}
            >
              {submitting ? "Processing…" : `Cancel and get a full ${planDisplayAmount} refund`}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setStep("confirm")} disabled={submitting}>
              Cancel without a refund
            </button>
            <button type="button" className="btn-link" onClick={onClose} disabled={submitting}>
              Never mind, keep my subscription
            </button>
          </div>
        </>
      ) : (
        <>
          <ModalHeader
            title="Cancel your yearly subscription"
            subtitle={`You'll keep full access until ${periodEndStr}.`}
          />
          <div className="cancel-info">
            <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.5 }}>
              Your subscription will end on <strong>{periodEndStr}</strong>. You'll keep full access until then. <strong>No refund</strong> will be issued — yearly plans are non-refundable after the {REFUND_WINDOW_DAYS}-day window.
            </p>
          </div>
          <div className="cancel-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Keep my subscription
            </button>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => setStep("confirm")}
              disabled={submitting}
            >
              Continue to cancel
            </button>
          </div>
        </>
      )}
    </>
  );

  const monthlySaveView = (() => {
    if (reason === "too_expensive") {
      return (
        <>
          <ModalHeader title="Hold on — we have a thank-you for you" subtitle="We hate to lose you over price. Try this on us:" />
          <div className="cancel-offer-card">
            <div className="cancel-offer-eyebrow">Special offer</div>
            <div className="cancel-offer-headline">50% off your next month</div>
            <div className="cancel-offer-sub">Your next renewal will be billed at half price. No strings, no commitments.</div>
          </div>
          <div className="cancel-actions cancel-actions-stack">
            <button type="button" className="btn btn-gold" onClick={handleApplyDiscount} disabled={submitting}>
              {submitting ? "Applying…" : "Apply this discount"}
            </button>
            <button type="button" className="btn-link" onClick={() => setStep("confirm")} disabled={submitting}>
              No thanks, cancel anyway
            </button>
          </div>
        </>
      );
    }

    // not_using / just_trying / other → pause offer
    return (
      <>
        <ModalHeader
          title="Need a break instead?"
          subtitle="Pause your subscription for 30 days. We'll keep your goals waiting and resume billing when you're ready."
        />
        <div className="cancel-offer-card">
          <div className="cancel-offer-eyebrow">No charge while paused</div>
          <div className="cancel-offer-headline">Pause for 30 days</div>
          <div className="cancel-offer-sub">Your subscription will automatically resume on day 31 — or you can resume sooner from your dashboard.</div>
        </div>
        <div className="cancel-actions cancel-actions-stack">
          <button type="button" className="btn btn-gold" onClick={handlePause} disabled={submitting}>
            {submitting ? "Pausing…" : "Pause for 30 days"}
          </button>
          <button type="button" className="btn-link" onClick={() => setStep("confirm")} disabled={submitting}>
            No thanks, cancel anyway
          </button>
        </div>
      </>
    );
  })();

  const confirmView = (
    <>
      <ModalHeader
        title="Are you sure?"
        subtitle={`You'll keep access until ${periodEndStr}. After that, your goals and progress stay safe — you can always come back.`}
      />
      <div className="cancel-info">
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--text)", fontSize: "0.92rem", lineHeight: 1.7 }}>
          <li>You won't be charged again.</li>
          <li>Your goals and history will be saved.</li>
          <li>You can resubscribe any time.</li>
        </ul>
      </div>
      <div className="cancel-actions cancel-actions-stack">
        <button
          type="button"
          className="btn btn-danger-strong"
          onClick={() => handleConfirmCancel(false)}
          disabled={submitting}
        >
          {submitting ? "Cancelling…" : "Cancel my subscription"}
        </button>
        <button type="button" className="btn btn-gold" onClick={onClose} disabled={submitting}>
          Never mind, keep my subscription
        </button>
      </div>
    </>
  );

  const successView = (
    <>
      <ModalHeader title="All done" subtitle={successMsg ?? ""} />
      <div className="cancel-actions">
        <button type="button" className="btn btn-gold" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );

  const errorView = (
    <>
      <ModalHeader title="Something went wrong" subtitle={error ?? "Please try again or contact support."} />
      <div className="cancel-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-gold" onClick={() => setStep("survey")}>
          Try again
        </button>
      </div>
    </>
  );

  return (
    <div
      className="cancel-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cancel-modal-card" role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label="Close"
          className="cancel-modal-close"
          onClick={onClose}
        >
          ×
        </button>

        {step === "survey" && surveyView}
        {step === "save" && (isYearly ? yearlySaveView : monthlySaveView)}
        {step === "confirm" && confirmView}
        {step === "success" && successView}
        {step === "error" && errorView}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 4, paddingRight: "1.5rem" }}>
      <h2
        style={{
          fontSize: "1.3rem",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "0.9rem",
            color: "var(--subtext)",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TaskItem {
  isCompleted?: boolean;
  isSkipped?: boolean;
}

const GOLD = "#D4A843";
const DARK = "#0a0a0a";
const TEXT = "#222222";
const SUBTEXT = "#555555";
const MUTED = "#888888";
const RULE = "#dddddd";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [user, goalCount, dailyTaskRecords] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.goal.count({ where: { userId: id } }),
    prisma.dailyTask.findMany({
      where: { userId: id },
      select: { date: true, tasks: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Tasks completed + days active
  let tasksCompleted = 0;
  const distinctDateKeys = new Set<string>();
  for (const dt of dailyTaskRecords) {
    const tasks = dt.tasks as unknown as TaskItem[] | null;
    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        if (t.isCompleted) tasksCompleted++;
      }
    }
    if (dt.date) {
      const key = new Date(dt.date).toISOString().split("T")[0];
      distinctDateKeys.add(key);
    }
  }
  const daysActive = distinctDateKeys.size;

  // Supabase auth user info
  let supaCreatedAt: string | null = null;
  let supaLastSignIn: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    supaCreatedAt = data?.user?.created_at ?? null;
    supaLastSignIn = data?.user?.last_sign_in_at ?? null;
  } catch {
    // ignore
  }

  // Stripe data
  type ChargeRow = {
    id: string;
    date: string;
    amount: number;
    status: string;
    refunded: boolean;
    refundedAmount: number;
  };
  const charges: ChargeRow[] = [];
  type SubEvent = { date: string; description: string };
  const subscriptionEvents: SubEvent[] = [];
  let currentSubStatus = "—";

  if (user.stripeCustomerId) {
    try {
      const stripe = getStripe();
      const stripeCharges = await stripe.charges.list({
        customer: user.stripeCustomerId,
        limit: 100,
      });
      for (const c of stripeCharges.data) {
        charges.push({
          id: c.id,
          date: new Date(c.created * 1000).toISOString(),
          amount: c.amount,
          status: c.status,
          refunded: c.refunded,
          refundedAmount: c.amount_refunded ?? 0,
        });
      }

      // Subscription events: cancellations, pauses, status changes
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 10,
      });
      for (const sub of subs.data) {
        subscriptionEvents.push({
          date: new Date(sub.start_date * 1000).toISOString(),
          description: `Subscription started (${sub.id})`,
        });
        if (sub.canceled_at) {
          subscriptionEvents.push({
            date: new Date(sub.canceled_at * 1000).toISOString(),
            description: `Subscription canceled`,
          });
        }
        if (sub.pause_collection?.resumes_at) {
          subscriptionEvents.push({
            date: new Date().toISOString(),
            description: `Paused (resumes ${new Date(
              sub.pause_collection.resumes_at * 1000
            ).toLocaleDateString()})`,
          });
        }
      }
      if (subs.data.length > 0) {
        currentSubStatus = subs.data[0].status;
      }

      // Refund events
      const refunds = await stripe.refunds.list({
        limit: 100,
      });
      for (const r of refunds.data) {
        if (typeof r.charge === "string") {
          const matchingCharge = charges.find((c) => c.id === r.charge);
          if (matchingCharge) {
            subscriptionEvents.push({
              date: new Date(r.created * 1000).toISOString(),
              description: `Refund issued: ${dollars(r.amount)}`,
            });
          }
        }
      }
    } catch (err) {
      console.error("[usage-report] Stripe fetch failed:", err);
    }
  }

  // Sort events by date
  subscriptionEvents.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
        info: {
          Title: `Threely Usage Report — ${user.email}`,
          Author: "Threely",
          Subject: "Account usage and billing history",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fillColor(GOLD)
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("THREELY", { align: "left" });
      doc
        .fillColor(TEXT)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Account Usage Report", { align: "left" });
      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(`Generated ${fmtDate(new Date())}`, { align: "left" });

      // Horizontal rule
      doc.moveDown(0.7);
      doc
        .strokeColor(GOLD)
        .lineWidth(1.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(1);

      // Section helper
      const section = (title: string) => {
        doc.moveDown(0.5);
        doc
          .fillColor(GOLD)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(title.toUpperCase(), { characterSpacing: 1 });
        doc
          .strokeColor(RULE)
          .lineWidth(0.5)
          .moveTo(doc.page.margins.left, doc.y + 2)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
          .stroke();
        doc.moveDown(0.4);
      };

      const labelValue = (label: string, value: string) => {
        doc
          .fillColor(SUBTEXT)
          .fontSize(9)
          .font("Helvetica")
          .text(label, { continued: true });
        doc
          .fillColor(TEXT)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("  " + value);
      };

      // Account info
      section("Account Information");
      labelValue("Email:", user.email);
      labelValue("User ID:", user.id);
      labelValue("DB Created:", fmtDate(user.createdAt));
      labelValue(
        "Auth Created:",
        supaCreatedAt ? fmtDate(supaCreatedAt) : "—"
      );
      labelValue(
        "Last Sign-In:",
        supaLastSignIn ? fmtDate(supaLastSignIn) : "—"
      );
      labelValue("Subscription Status:", user.subscriptionStatus ?? "none");
      labelValue("Stripe Status:", currentSubStatus);
      labelValue("Stripe Customer ID:", user.stripeCustomerId ?? "—");
      if (user.trialClaimedAt) {
        labelValue("Trial Claimed:", fmtDate(user.trialClaimedAt));
      }
      if (user.trialEndsAt) {
        labelValue("Trial Ends:", fmtDate(user.trialEndsAt));
      }

      // Usage stats
      section("Usage Statistics");
      labelValue("Total Goals Created:", String(goalCount));
      labelValue("Daily Task Records:", String(dailyTaskRecords.length));
      labelValue("Total Tasks Completed:", String(tasksCompleted));
      labelValue("Days Active:", String(daysActive));

      // Subscription history (charges)
      section("Billing History");
      if (charges.length === 0) {
        doc
          .fillColor(MUTED)
          .fontSize(10)
          .font("Helvetica-Oblique")
          .text("No billing history found.");
      } else {
        // Table header
        const colDate = doc.page.margins.left;
        const colAmount = colDate + 150;
        const colStatus = colAmount + 90;
        const colId = colStatus + 100;
        const headerY = doc.y;
        doc
          .fillColor(SUBTEXT)
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("DATE", colDate, headerY, { width: 150 });
        doc.text("AMOUNT", colAmount, headerY, { width: 90 });
        doc.text("STATUS", colStatus, headerY, { width: 100 });
        doc.text("CHARGE ID", colId, headerY, { width: 200 });
        doc.moveDown(0.3);
        doc
          .strokeColor(RULE)
          .lineWidth(0.4)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.2);

        for (const c of charges) {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
          }
          const rowY = doc.y;
          doc
            .fillColor(TEXT)
            .fontSize(9)
            .font("Helvetica")
            .text(fmtDate(c.date), colDate, rowY, { width: 150 });
          doc.text(dollars(c.amount), colAmount, rowY, { width: 90 });
          const statusLabel = c.refunded
            ? "refunded"
            : c.refundedAmount > 0
              ? "partial refund"
              : c.status;
          doc
            .fillColor(c.refunded ? "#aa0000" : c.status === "succeeded" ? "#0a7a3a" : MUTED)
            .text(statusLabel, colStatus, rowY, { width: 100 });
          doc
            .fillColor(MUTED)
            .fontSize(8)
            .text(c.id, colId, rowY, { width: 200 });
          doc.moveDown(0.5);
        }
      }

      // Subscription events
      section("Subscription Events");
      if (subscriptionEvents.length === 0) {
        doc
          .fillColor(MUTED)
          .fontSize(10)
          .font("Helvetica-Oblique")
          .text("No subscription events recorded.");
      } else {
        for (const ev of subscriptionEvents) {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
          }
          doc
            .fillColor(SUBTEXT)
            .fontSize(9)
            .font("Helvetica")
            .text(fmtDate(ev.date), { continued: true });
          doc
            .fillColor(TEXT)
            .font("Helvetica-Bold")
            .text("  " + ev.description);
        }
      }

      // Login records
      section("Login Records");
      labelValue(
        "Account Created:",
        supaCreatedAt ? fmtDate(supaCreatedAt) : fmtDate(user.createdAt)
      );
      labelValue(
        "Last Sign-In:",
        supaLastSignIn ? fmtDate(supaLastSignIn) : "—"
      );
      doc
        .moveDown(0.3)
        .fillColor(MUTED)
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          "Note: Detailed sign-in history is not retained beyond the most recent sign-in timestamp."
        );

      // Footer
      doc.moveDown(2);
      doc
        .strokeColor(GOLD)
        .lineWidth(1.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.5);
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          "This document was generated for chargeback dispute purposes. Contact support@threely.co",
          { align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `threely-usage-${id}-${dateStr}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}

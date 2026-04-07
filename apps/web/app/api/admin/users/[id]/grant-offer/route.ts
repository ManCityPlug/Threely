import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { applyOfferToStripe } from "@/lib/offer-stripe";
import { sendOfferNotification, sendOfferAutoApplied } from "@/lib/email";

export const dynamic = "force-dynamic";

interface GrantBody {
  type: string;
  value: number;
  duration?: string;
  durationMonths?: number;
  mode: "manual" | "auto";
  expirationDays?: number;
  description: string;
}

const VALID_TYPES = new Set([
  "discount_percent",
  "discount_amount",
  "free_month",
  "pause",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: GrantBody;
  try {
    body = (await request.json()) as GrantBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate input
  if (!body.type || !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Invalid offer type" }, { status: 400 });
  }
  if (typeof body.value !== "number" || body.value <= 0) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }
  if (body.mode !== "manual" && body.mode !== "auto") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (!body.description || body.description.trim().length === 0) {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Enforce one active offer at a time
  const existingActive = await prisma.offer.findFirst({
    where: {
      userId: id,
      status: { in: ["pending", "auto_applied"] },
      expiresAt: { gt: new Date() },
    },
  });
  if (existingActive) {
    return NextResponse.json(
      {
        error:
          "User already has an active offer. Revoke it before granting a new one.",
      },
      { status: 409 }
    );
  }

  // Calculate expiration
  const expirationDays =
    body.mode === "manual" ? Math.max(1, body.expirationDays ?? 7) : 365;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  // For auto mode, apply to Stripe immediately
  if (body.mode === "auto") {
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "User has no Stripe customer ID; cannot auto-apply" },
        { status: 400 }
      );
    }

    try {
      await applyOfferToStripe(user.stripeCustomerId, {
        type: body.type,
        value: body.value,
        duration: body.duration ?? null,
        durationMonths: body.durationMonths ?? null,
        description: body.description,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe apply failed";
      return NextResponse.json(
        { error: `Failed to apply offer to Stripe: ${msg}` },
        { status: 500 }
      );
    }

    const offer = await prisma.offer.create({
      data: {
        userId: id,
        type: body.type,
        value: body.value,
        duration: body.duration ?? null,
        durationMonths: body.durationMonths ?? null,
        description: body.description,
        mode: "auto",
        status: "auto_applied",
        expiresAt,
        claimedAt: new Date(),
      },
    });

    try {
      await sendOfferAutoApplied(user.email, body.description);
    } catch {
      // don't fail the request if email fails
    }

    return NextResponse.json({ success: true, offer });
  }

  // Manual mode: create as pending
  const offer = await prisma.offer.create({
    data: {
      userId: id,
      type: body.type,
      value: body.value,
      duration: body.duration ?? null,
      durationMonths: body.durationMonths ?? null,
      description: body.description,
      mode: "manual",
      status: "pending",
      expiresAt,
    },
  });

  try {
    await sendOfferNotification(user.email, body.description);
  } catch {
    // don't fail the request if email fails
  }

  return NextResponse.json({ success: true, offer });
}

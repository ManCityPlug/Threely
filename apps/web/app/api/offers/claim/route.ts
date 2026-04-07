import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";
import { applyOfferToStripe } from "@/lib/offer-stripe";

export const dynamic = "force-dynamic";

interface ClaimBody {
  offerId: string;
}

export async function POST(request: NextRequest) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: body.offerId },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (offer.userId !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offer.status !== "pending") {
    return NextResponse.json(
      { error: `Offer is ${offer.status}` },
      { status: 400 }
    );
  }

  if (offer.expiresAt < new Date()) {
    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: "expired" },
    });
    return NextResponse.json({ error: "Offer has expired" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
  });
  if (!user || !user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer ID — please contact support" },
      { status: 400 }
    );
  }

  // Apply to Stripe
  let applyResult;
  try {
    applyResult = await applyOfferToStripe(user.stripeCustomerId, {
      type: offer.type,
      value: offer.value,
      duration: offer.duration,
      durationMonths: offer.durationMonths,
      description: offer.description,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to apply offer";
    return NextResponse.json(
      { error: `Failed to apply offer: ${msg}` },
      { status: 500 }
    );
  }

  await prisma.offer.update({
    where: { id: offer.id },
    data: { status: "claimed", claimedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    details: applyResult.details,
    description: offer.description,
  });
}

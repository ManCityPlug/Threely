import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { removeOfferFromStripe } from "@/lib/offer-stripe";

export const dynamic = "force-dynamic";

interface RevokeBody {
  offerId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: RevokeBody;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: body.offerId },
    include: { user: true },
  });

  if (!offer || offer.userId !== id) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (offer.status === "revoked" || offer.status === "expired") {
    return NextResponse.json(
      { error: `Offer is already ${offer.status}` },
      { status: 400 }
    );
  }

  let stripeRemovalNote: string | null = null;

  // If already auto-applied, attempt removal from Stripe
  if (offer.status === "auto_applied" && offer.user.stripeCustomerId) {
    const removed = await removeOfferFromStripe(
      offer.user.stripeCustomerId,
      offer.type
    );
    if (!removed) {
      stripeRemovalNote =
        "Could not automatically reverse this offer in Stripe. Manual review may be required.";
      console.warn(
        `[revoke-offer] Could not remove ${offer.type} offer ${offer.id} from Stripe customer ${offer.user.stripeCustomerId}`
      );
    }
  }

  await prisma.offer.update({
    where: { id: body.offerId },
    data: { status: "revoked" },
  });

  return NextResponse.json({
    success: true,
    note: stripeRemovalNote,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const VALID_KINDS = ["phase_change", "asset_ready", "note", "upcoming"] as const;

// ─── POST /api/admin/launches/[id]/events ───────────────────────────────────
// Append a LaunchEvent. Used mainly to add "upcoming" deliverables (eta, detail)
// or a free-form note admins want to surface on the user's /launch timeline.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const launch = await prisma.launch.findUnique({ where: { id } });
  if (!launch) return NextResponse.json({ error: "Launch not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind   = String(body.kind ?? "note");
  const title  = String(body.title ?? "").trim();
  const detail = body.detail ? String(body.detail) : null;
  const eta    = body.eta ? String(body.eta) : null;

  if (!VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    return NextResponse.json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const event = await prisma.launchEvent.create({
    data: { launchId: id, kind, title, detail, eta },
  });

  return NextResponse.json({ event });
}

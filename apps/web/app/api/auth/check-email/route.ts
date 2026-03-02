import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/auth/check-email — check if an email is registered
export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) as { email?: string };
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true },
    });

    return NextResponse.json({ exists: !!user });
  } catch (e) {
    console.error("[POST /api/auth/check-email]", e);
    // On error, don't leak info — say it exists so they get generic error
    return NextResponse.json({ exists: true });
  }
}

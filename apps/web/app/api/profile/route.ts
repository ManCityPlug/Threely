import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/supabase";

// GET /api/profile — get the user's profile (daily time + intensity)
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({ profile });
}

// POST /api/profile — upsert user profile
// Body: { dailyTimeMinutes?: number, intensityLevel?: number }
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { dailyTimeMinutes, intensityLevel, theme } = body as {
    dailyTimeMinutes?: number;
    intensityLevel?: number;
    theme?: string;
  };

  // Ensure user record exists
  await prisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email },
    update: {},
  });

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      dailyTimeMinutes: dailyTimeMinutes ?? 60,
      intensityLevel: intensityLevel ?? 2,
      theme: theme ?? "light",
    },
    update: {
      ...(dailyTimeMinutes != null ? { dailyTimeMinutes } : {}),
      ...(intensityLevel != null ? { intensityLevel } : {}),
      ...(theme != null ? { theme } : {}),
    },
  });

  return NextResponse.json({ profile });
}

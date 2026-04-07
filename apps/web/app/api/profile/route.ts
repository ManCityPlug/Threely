import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnyUserFromRequest } from "@/lib/supabase";

// GET /api/profile — get the user's profile (daily time + intensity)
export async function GET(request: NextRequest) {
  try {
    const user = await getAnyUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({ profile });
  } catch (e) {
    console.error("[GET /api/profile]", e);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// POST /api/profile — upsert user profile
// Body: { dailyTimeMinutes?: number, intensityLevel?: number }
export async function POST(request: NextRequest) {
  try {
    const user = await getAnyUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { dailyTimeMinutes, intensityLevel, theme } = body as {
      dailyTimeMinutes?: number;
      intensityLevel?: number;
      theme?: string;
    };

    if (dailyTimeMinutes != null && (dailyTimeMinutes < 5 || dailyTimeMinutes > 480)) {
      return NextResponse.json({ error: "dailyTimeMinutes must be between 5 and 480" }, { status: 400 });
    }
    if (intensityLevel != null && (intensityLevel < 1 || intensityLevel > 3)) {
      return NextResponse.json({ error: "intensityLevel must be 1, 2, or 3" }, { status: 400 });
    }
    if (theme != null && !["light", "dark"].includes(theme)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }

    // Ensure user record exists (anon users get a placeholder email)
    const userEmail = user.email ?? `anon-${user.id}@anon.threely.local`;
    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, email: userEmail },
      update: user.email ? { email: user.email } : {},
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
  } catch (e) {
    console.error("[POST /api/profile]", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

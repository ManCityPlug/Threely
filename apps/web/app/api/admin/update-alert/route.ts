import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.systemConfig.findUnique({
    where: { key: "minAppVersion" },
  });

  return NextResponse.json({
    minAppVersion: config?.value ?? "1.0.0",
  });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { version } = await request.json();

  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "Invalid version format. Use semver (e.g., 1.2.0)" },
      { status: 400 }
    );
  }

  await prisma.systemConfig.upsert({
    where: { key: "minAppVersion" },
    update: { value: version },
    create: { key: "minAppVersion", value: version },
  });

  return NextResponse.json({ minAppVersion: version });
}

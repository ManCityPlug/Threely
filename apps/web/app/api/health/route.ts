import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dateUtils";

export async function GET() {
  let minAppVersion = "1.0.0";
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "minAppVersion" },
    });
    if (config?.value) minAppVersion = config.value;
  } catch {
    // DB failure — fall back to safe default so the app doesn't block anyone
  }

  return NextResponse.json({
    status: "ok",
    service: "threely-api",
    minAppVersion,
    timestamp: formatDate(new Date()),
  });
}

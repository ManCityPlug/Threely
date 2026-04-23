import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";
import { composeLogo, ICON_IDS, PALETTE_IDS, FONT_IDS } from "@threely/dfy/logos";
import type { ComposedLogo } from "@threely/dfy/logos";

// POST /api/dfy/logo
// Body: {
//   businessName: string,
//   style?: "icon_above" | "icon_left" | "text_only",
//   iconId?: string,
//   paletteId?: string,
//   fontId?: string,
//   batch?: boolean,   // if true, return 6 variants
// }
// Returns: { logo: ComposedLogo } | { logos: ComposedLogo[] }

const VALID_STYLES = ["icon_above", "icon_left", "text_only"] as const;
type Style = (typeof VALID_STYLES)[number];

// 6 batch variants: rotate style + icon + palette + font deterministically
const BATCH_OVERRIDES: Array<Partial<{ style: Style; iconId: string; paletteId: string; fontId: string }>> = [
  { style: "icon_above" },
  { style: "icon_left" },
  { style: "text_only" },
  { style: "icon_above", paletteId: "vibrant_playful" },
  { style: "icon_left", paletteId: "ocean", fontId: "sans_modern" },
  { style: "icon_above", paletteId: "cream", fontId: "display_serif" },
];

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { businessName, style, iconId, paletteId, fontId, batch } = body as {
    businessName?: string;
    style?: string;
    iconId?: string;
    paletteId?: string;
    fontId?: string;
    batch?: boolean;
  };

  // --- Validate businessName ---
  if (!businessName || typeof businessName !== "string") {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }
  const trimmedName = businessName.trim();
  if (trimmedName.length === 0) {
    return NextResponse.json({ error: "businessName must not be empty" }, { status: 400 });
  }
  if (trimmedName.length > 50) {
    return NextResponse.json(
      { error: "businessName must be 50 characters or fewer" },
      { status: 400 }
    );
  }

  // --- Validate optional style ---
  const resolvedStyle: Style | undefined =
    style && VALID_STYLES.includes(style as Style) ? (style as Style) : undefined;

  // --- Validate optional iconId ---
  const resolvedIconId =
    iconId && ICON_IDS.includes(iconId) ? iconId : undefined;

  // --- Validate optional paletteId ---
  const resolvedPaletteId =
    paletteId && PALETTE_IDS.includes(paletteId) ? paletteId : undefined;

  // --- Validate optional fontId ---
  const resolvedFontId =
    fontId && FONT_IDS.includes(fontId) ? fontId : undefined;

  // Use user.id as seed for deterministic results per user
  const seed = user.id;

  try {
    if (batch) {
      const logos: ComposedLogo[] = await Promise.all(
        BATCH_OVERRIDES.map((override) =>
          composeLogo({
            businessName: trimmedName,
            style: override.style ?? resolvedStyle ?? "icon_above",
            iconId: override.iconId ?? resolvedIconId,
            paletteId: override.paletteId ?? resolvedPaletteId,
            fontId: override.fontId ?? resolvedFontId,
            seed: `${seed}-${override.style ?? "default"}-${override.paletteId ?? ""}`,
            width: 600,
            height: 600,
          })
        )
      );
      return NextResponse.json({ logos }, { status: 200 });
    }

    const logo = await composeLogo({
      businessName: trimmedName,
      style: resolvedStyle ?? "icon_above",
      iconId: resolvedIconId,
      paletteId: resolvedPaletteId,
      fontId: resolvedFontId,
      seed,
      width: 600,
      height: 600,
    });

    return NextResponse.json({ logo }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/dfy/logo]", msg, e);
    return NextResponse.json({ error: "Failed to compose logo" }, { status: 500 });
  }
}

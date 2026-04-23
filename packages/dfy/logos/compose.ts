import { ICONS, ICON_IDS } from "./icons";
import { PALETTES, PALETTE_IDS, type Palette } from "./palettes";
import { FONTS, FONT_IDS, type Font } from "./fonts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposeLogoInput {
  businessName: string;
  style?: "icon_above" | "icon_left" | "text_only";
  iconId?: string;
  paletteId?: string;
  fontId?: string;
  seed?: string;
  width?: number;
  height?: number;
}

export interface ComposedLogo {
  pngBase64: string;
  svg: string;
  iconId: string;
  paletteId: string;
  fontId: string;
}

// ---------------------------------------------------------------------------
// Deterministic RNG — FNV-1a hash + LCG
// ---------------------------------------------------------------------------

function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function lcgNext(state: number): number {
  // Knuth's multiplier + fixed increment, 32-bit
  return ((state * 1664525 + 1013904223) >>> 0);
}

function seededPick<T>(arr: T[], seed: string, salt: string): T {
  const s = lcgNext(fnv1a(seed + salt));
  return arr[s % arr.length];
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

/**
 * Strip the outer <svg ...>...</svg> wrapper and return just the inner markup.
 * Also strips any XML-invalid attributes we don't want nested.
 */
function extractInnerSvg(svgString: string): string {
  return svgString.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "").trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Layout builders
// ---------------------------------------------------------------------------

interface LayoutParams {
  W: number;
  H: number;
  iconSize: number;
  iconX: number;
  iconY: number;
  textX: number;
  textY: number;
  textAnchor: string;
  fontSize: number;
}

function layoutIconAbove(W: number, H: number): LayoutParams {
  const iconSize = Math.round(W * 0.32);
  const iconX = (W - iconSize) / 2;
  const iconY = Math.round(H * 0.18);
  const fontSize = Math.min(Math.round(W * 0.11), 72);
  const textX = W / 2;
  const textY = Math.round(H * 0.72);
  return { W, H, iconSize, iconX, iconY, textX, textY, textAnchor: "middle", fontSize };
}

function layoutIconLeft(W: number, H: number): LayoutParams {
  const iconSize = Math.round(H * 0.3);
  const iconX = Math.round(W * 0.08);
  const iconY = (H - iconSize) / 2;
  const fontSize = Math.min(Math.round(W * 0.1), 68);
  const textX = Math.round(W * 0.42);
  const textY = H / 2 + fontSize * 0.35;
  return { W, H, iconSize, iconX, iconY, textX, textY, textAnchor: "middle", fontSize };
}

function layoutTextOnly(W: number, H: number): LayoutParams {
  const fontSize = Math.min(Math.round(W * 0.13), 80);
  return {
    W,
    H,
    iconSize: 0,
    iconX: 0,
    iconY: 0,
    textX: W / 2,
    textY: H / 2 + fontSize * 0.35,
    textAnchor: "middle",
    fontSize,
  };
}

// ---------------------------------------------------------------------------
// SVG composer
// ---------------------------------------------------------------------------

function buildSvg(
  businessName: string,
  style: "icon_above" | "icon_left" | "text_only",
  palette: Palette,
  font: Font,
  iconId: string,
  W: number,
  H: number
): string {
  const layout =
    style === "icon_above"
      ? layoutIconAbove(W, H)
      : style === "icon_left"
      ? layoutIconLeft(W, H)
      : layoutTextOnly(W, H);

  const { iconSize, iconX, iconY, textX, textY, textAnchor, fontSize } = layout;

  const fontStyle = font.style ?? "normal";
  const safeName = escapeXml(businessName);

  // Build icon group (translated + scaled from 24×24 viewBox)
  let iconGroup = "";
  if (style !== "text_only" && iconSize > 0 && ICONS[iconId]) {
    const scale = iconSize / 24;
    const innerSvg = extractInnerSvg(ICONS[iconId]);
    iconGroup = `
  <g transform="translate(${iconX}, ${iconY}) scale(${scale.toFixed(4)})" stroke="${palette.accent}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${innerSvg}
  </g>`;
  }

  // Determine a comfortable letter-spacing
  const letterSpacing = style === "text_only" ? "0.04em" : "0.03em";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${palette.bg}"/>
  ${iconGroup}
  <text
    x="${textX}"
    y="${textY}"
    text-anchor="${textAnchor}"
    font-family="${font.stack}"
    font-size="${fontSize}"
    font-weight="${font.weight}"
    font-style="${fontStyle}"
    fill="${palette.fg}"
    letter-spacing="${letterSpacing}"
  >${safeName}</text>
</svg>`;

  return svg;
}

// ---------------------------------------------------------------------------
// Sharp PNG render
// ---------------------------------------------------------------------------

async function svgToPng(svg: string, width: number, height: number): Promise<string> {
  // Dynamic require so this only runs server-side (Next.js API route)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require("sharp") as typeof import("sharp");
  const buf = await sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function composeLogo(input: ComposeLogoInput): Promise<ComposedLogo> {
  const {
    businessName,
    style = "icon_above",
    seed = businessName,
    width = 600,
    height = 600,
  } = input;

  // Resolve icon
  const iconId =
    input.iconId && ICON_IDS.includes(input.iconId)
      ? input.iconId
      : seededPick(ICON_IDS, seed, "icon");

  // Resolve palette
  const palette =
    input.paletteId && PALETTE_IDS.includes(input.paletteId)
      ? PALETTES.find((p) => p.id === input.paletteId)!
      : seededPick(PALETTES, seed, "palette");

  // Resolve font
  const font =
    input.fontId && FONT_IDS.includes(input.fontId)
      ? FONTS.find((f) => f.id === input.fontId)!
      : seededPick(FONTS, seed, "font");

  const svg = buildSvg(businessName, style, palette, font, iconId, width, height);
  const pngBase64 = await svgToPng(svg, width, height);

  return {
    pngBase64,
    svg,
    iconId,
    paletteId: palette.id,
    fontId: font.id,
  };
}

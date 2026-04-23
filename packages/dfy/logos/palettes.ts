export interface Palette {
  id: string;
  bg: string;
  fg: string;
  accent: string;
  name: string;
}

export const PALETTES: Palette[] = [
  // mono_dark — Classic
  { id: "mono_dark", bg: "#0A0A0A", fg: "#FFFFFF", accent: "#D4A843", name: "Classic" },

  // cream — Warm
  { id: "cream", bg: "#F5F0E8", fg: "#1A1A1A", accent: "#C17767", name: "Warm" },

  // muted_tech — Steel blue-gray
  { id: "muted_tech", bg: "#1C2333", fg: "#E8EDF5", accent: "#5B8DEF", name: "Tech" },

  // vibrant_playful — Electric purple
  { id: "vibrant_playful", bg: "#F0EBFF", fg: "#2D1B69", accent: "#7C3AED", name: "Playful" },

  // pastel — Soft pink
  { id: "pastel", bg: "#FFF0F5", fg: "#4A1A2C", accent: "#E879A0", name: "Pastel" },

  // earthy — Natural tones
  { id: "earthy", bg: "#F2EDE3", fg: "#2C2416", accent: "#8B6914", name: "Earthy" },

  // bold_dtc — High contrast orange
  { id: "bold_dtc", bg: "#FF4713", fg: "#FFFFFF", accent: "#FFD600", name: "Bold" },

  // soft_beauty — Blush rose
  { id: "soft_beauty", bg: "#FAF3F0", fg: "#3D1F1F", accent: "#C9897B", name: "Beauty" },

  // minimalist_white — Clean white
  { id: "minimalist_white", bg: "#FFFFFF", fg: "#111111", accent: "#111111", name: "Minimal" },

  // sunset — Gradient warm
  { id: "sunset", bg: "#1A0533", fg: "#FFE4CC", accent: "#FF7043", name: "Sunset" },

  // ocean — Deep teal
  { id: "ocean", bg: "#0D2137", fg: "#E0F4FF", accent: "#00C9C8", name: "Ocean" },

  // forest — Deep green
  { id: "forest", bg: "#0F1F0F", fg: "#D8EDD8", accent: "#4CAF50", name: "Forest" },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);

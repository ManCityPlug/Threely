export interface Font {
  id: string;
  stack: string;
  weight: number;
  style?: string;
}

export const FONTS: Font[] = [
  // serif_classic — Traditional editorial feel
  {
    id: "serif_classic",
    stack: "Georgia, 'Times New Roman', Times, serif",
    weight: 700,
  },

  // sans_modern — Clean contemporary
  {
    id: "sans_modern",
    stack: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    weight: 800,
  },

  // script_bold — Personality / lifestyle brands (simulated via italic+serif)
  {
    id: "script_bold",
    stack: "Palatino Linotype, Palatino, 'Book Antiqua', serif",
    weight: 700,
    style: "italic",
  },

  // slab_serif — Solid, trustworthy
  {
    id: "slab_serif",
    stack: "'Courier New', Courier, monospace",
    weight: 700,
  },

  // geometric_sans — Bauhaus-inspired
  {
    id: "geometric_sans",
    stack: "Futura, Century Gothic, 'Century Gothic', 'Apple Gothic', sans-serif",
    weight: 700,
  },

  // display_serif — High-end editorial
  {
    id: "display_serif",
    stack: "Didot, 'Bodoni MT', 'Playfair Display', Georgia, serif",
    weight: 700,
  },

  // mono — Developer / tech brands
  {
    id: "mono",
    stack: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
    weight: 600,
  },

  // condensed_sans — Impact, bold headline
  {
    id: "condensed_sans",
    stack: "'Arial Narrow', 'Helvetica Condensed', Impact, 'Arial Black', sans-serif",
    weight: 900,
  },
];

export const FONT_IDS = FONTS.map((f) => f.id);

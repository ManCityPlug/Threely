"use client";

import { useCallback, useRef, useState } from "react";

const BRAND = "#635BFF";
const BG_OPTIONS = [
  { label: "Brand Purple", value: "linear-gradient(160deg, #635BFF 0%, #4B45D6 100%)" },
  { label: "Dark", value: "linear-gradient(160deg, #1A1040 0%, #2D2066 100%)" },
  { label: "Light", value: "linear-gradient(160deg, #f6f9fc 0%, #e3e8ef 100%)" },
  { label: "Sunset", value: "linear-gradient(160deg, #FF6B6B 0%, #635BFF 100%)" },
  { label: "Ocean", value: "linear-gradient(160deg, #635BFF 0%, #00C9A7 100%)" },
  { label: "Midnight", value: "linear-gradient(160deg, #0a2540 0%, #635BFF 100%)" },
];

// App Store sizes
const SIZES = [
  { label: '6.7" (iPhone 15 Pro Max)', w: 1290, h: 2796 },
  { label: '6.5" (iPhone 11 Pro Max)', w: 1284, h: 2778 },
  { label: '5.5" (iPhone 8 Plus)', w: 1242, h: 2208 },
  { label: '12.9" iPad Pro', w: 2048, h: 2732 },
  { label: '11" iPad Pro', w: 1668, h: 2388 },
];

interface Slide {
  id: string;
  image: string | null;
  headline: string;
  subtitle: string;
  imageOffsetY: number; // percentage offset: negative = up, positive = down
}

const DEFAULT_SLIDES: Slide[] = [
  { id: "1", image: null, headline: "Your goals, broken into\n3 daily tasks", subtitle: "AI builds your personalized plan", imageOffsetY: 0 },
  { id: "2", image: null, headline: "AI-powered coaching\nfor every task", subtitle: "Ask AI anything about your tasks", imageOffsetY: 0 },
  { id: "3", image: null, headline: "Track all your goals\nin one place", subtitle: "Stay organized and focused", imageOffsetY: 0 },
  { id: "4", image: null, headline: "Start free\nfor 7 days", subtitle: "No commitment required", imageOffsetY: 0 },
  { id: "5", image: null, headline: "Personalized plans\nbuilt by AI", subtitle: "Adapted to your schedule and level", imageOffsetY: 0 },
  { id: "6", image: null, headline: "Review your day,\ngrow every week", subtitle: "Build lasting habits with daily reviews", imageOffsetY: 0 },
];

export default function ScreenshotsPage() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [bgIdx, setBgIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [showDevice, setShowDevice] = useState(true);
  const [exporting, setExporting] = useState(false);

  const bg = BG_OPTIONS[bgIdx].value;
  const size = SIZES[sizeIdx];

  function updateSlide(idx: number, field: keyof Slide, value: string | null | number) {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function handleImageUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSlide(idx, "image", reader.result as string);
    reader.readAsDataURL(file);
  }

  const renderToCanvas = useCallback(
    async (slide: Slide, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;
      const W = size.w;
      const H = size.h;
      canvas.width = W;
      canvas.height = H;

      // Background gradient
      const gradMatch = bg.match(/linear-gradient\(\d+deg,\s*(#\w+)\s+\d+%,\s*(#\w+)\s+\d+%\)/);
      if (gradMatch) {
        const grad = ctx.createLinearGradient(0, 0, W * 0.4, H);
        grad.addColorStop(0, gradMatch[1]);
        grad.addColorStop(1, gradMatch[2]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = BRAND;
      }
      ctx.fillRect(0, 0, W, H);

      // Measure text sizes (used for both image and text drawing)
      // CSS paddingTop: "5%" is relative to WIDTH (CSS spec), not height
      const textY = W * 0.05;
      const headlineSize = Math.round(W * 0.062);
      const subtitleSize = Math.round(W * 0.032);
      const headlineLines = slide.headline.split("\n");

      // Draw phone screenshot FIRST (so text renders on top)
      if (slide.image) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = slide.image!;
        });

        if (showDevice) {
          // Phone frame dimensions
          const phoneW = W * 0.82;
          const phoneH = phoneW * (img.height / img.width);
          const phoneX = (W - phoneW) / 2;
          // Bottom-align phone to match CSS flex-end preview
          // Offset is percentage of phone's own height (matches CSS translateY)
          const yOffset = (slide.imageOffsetY / 100) * phoneH;
          const phoneY = H - phoneH + yOffset;
          const cornerR = phoneW * 0.07;

          // Phone shadow
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 60;
          ctx.shadowOffsetY = 20;

          // Rounded rect clip for phone
          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.fillStyle = "#000";
          ctx.fill();
          ctx.restore();

          // Draw screenshot clipped to rounded rect
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.clip();
          ctx.drawImage(img, phoneX, phoneY, phoneW, phoneH);
          ctx.restore();

          // Subtle border
          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          // No frame — just the image
          const imgW = W * 0.9;
          const imgH = imgW * (img.height / img.width);
          const imgX = (W - imgW) / 2;
          const yOffset = (slide.imageOffsetY / 100) * imgH;
          const imgY = H - imgH + yOffset;
          ctx.drawImage(img, imgX, imgY, imgW, imgH);
        }
      }

      // Draw text ON TOP of the image so it's never covered
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.font = `800 ${headlineSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      headlineLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, textY + headlineSize * 1.15 * (i + 1));
      });

      const subY = textY + headlineSize * 1.15 * headlineLines.length + headlineSize * 0.4;
      ctx.font = `500 ${subtitleSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(slide.subtitle, W / 2, subY);
      ctx.globalAlpha = 1;
    },
    [bg, size, textColor, showDevice]
  );

  async function exportAll() {
    setExporting(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (!slide.image) continue;
        const canvas = document.createElement("canvas");
        await renderToCanvas(slide, canvas);
        const link = document.createElement("a");
        link.download = `threely-screenshot-${i + 1}-${size.w}x${size.h}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setExporting(false);
    }
  }

  async function exportOne(idx: number) {
    const slide = slides[idx];
    const canvas = document.createElement("canvas");
    await renderToCanvas(slide, canvas);
    const link = document.createElement("a");
    link.download = `threely-screenshot-${idx + 1}-${size.w}x${size.h}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#e8e8e8", background: "rgba(255,255,255,0.02)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#141414", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "1rem 1.5rem", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
            <span style={{ color: BRAND }}>Threely</span> Screenshot Generator
          </h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {/* Size selector */}
            <select
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
              style={{ padding: "0.4rem 0.75rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {SIZES.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>

            {/* Background selector */}
            <select
              value={bgIdx}
              onChange={(e) => setBgIdx(Number(e.target.value))}
              style={{ padding: "0.4rem 0.75rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.85rem", cursor: "pointer" }}
            >
              {BG_OPTIONS.map((b, i) => (
                <option key={i} value={i}>{b.label}</option>
              ))}
            </select>

            {/* Text color */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", cursor: "pointer" }}>
              Text:
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                style={{ width: 28, height: 28, border: "none", cursor: "pointer", borderRadius: 4 }}
              />
            </label>

            {/* Device frame toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", cursor: "pointer" }}>
              <input type="checkbox" checked={showDevice} onChange={(e) => setShowDevice(e.target.checked)} />
              Device frame
            </label>

            {/* Export all */}
            <button
              onClick={exportAll}
              disabled={exporting}
              style={{
                background: BRAND,
                color: "#fff",
                border: "none",
                padding: "0.5rem 1.25rem",
                borderRadius: "0.5rem",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: exporting ? "wait" : "pointer",
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? "Exporting..." : "Export All PNGs"}
            </button>
          </div>
        </div>
      </div>

      {/* Slides grid */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
          {slides.map((slide, idx) => (
            <div key={slide.id} style={{ background: "#141414", borderRadius: "1rem", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              {/* Preview */}
              <div
                style={{
                  aspectRatio: `${size.w} / ${size.h}`,
                  background: bg,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onClick={() => exportOne(idx)}
                title="Click to export this screenshot"
              >
                {/* Text overlay — always on top of phone image */}
                <div style={{ paddingTop: "5%", textAlign: "center", zIndex: 2, position: "relative", paddingInline: "1rem" }}>
                  <div style={{
                    fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
                    fontWeight: 800,
                    color: textColor,
                    lineHeight: 1.2,
                    letterSpacing: "-0.03em",
                    whiteSpace: "pre-line",
                  }}>
                    {slide.headline}
                  </div>
                  <div style={{
                    fontSize: "clamp(0.6rem, 1.2vw, 0.75rem)",
                    color: textColor,
                    opacity: 0.8,
                    marginTop: "0.4rem",
                    fontWeight: 500,
                  }}>
                    {slide.subtitle}
                  </div>
                </div>

                {/* Phone image preview */}
                {slide.image && (
                  <div style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    padding: "0.5rem",
                    paddingBottom: 0,
                    width: "100%",
                  }}>
                    <div style={{
                      width: showDevice ? "82%" : "90%",
                      borderRadius: showDevice ? "clamp(12px, 3vw, 24px)" : 0,
                      overflow: "hidden",
                      boxShadow: showDevice ? "0 20px 60px rgba(0,0,0,0.35)" : "none",
                      border: showDevice ? "2px solid rgba(255,255,255,0.15)" : "none",
                      lineHeight: 0,
                      transform: `translateY(${slide.imageOffsetY}%)`,
                    }}>
                      <img
                        src={slide.image}
                        alt=""
                        style={{ width: "100%", display: "block" }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload prompt if no image */}
                {!slide.image && (
                  <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: textColor,
                    opacity: 0.5,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}>
                    Upload a screenshot below
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: BRAND, minWidth: 18 }}>#{idx + 1}</span>
                  <label
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.45rem",
                      borderRadius: "0.5rem",
                      border: "1.5px dashed #d0d5dd",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                      transition: "border-color 0.15s",
                    }}
                  >
                    {slide.image ? "Replace image" : "Upload screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(idx, e)}
                      style={{ display: "none" }}
                    />
                  </label>
                  {slide.image && (
                    <button
                      onClick={() => updateSlide(idx, "image", null)}
                      style={{ background: "none", border: "none", color: "#e25c3d", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: "0.25rem" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {slide.image && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", minWidth: 54 }}>Position:</span>
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", slide.imageOffsetY - 2)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
                        background: "#141414", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)",
                      }}
                      title="Move image up"
                    >
                      &#x25B2;
                    </button>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={slide.imageOffsetY}
                      onChange={(e) => updateSlide(idx, "imageOffsetY", Number(e.target.value))}
                      style={{ flex: 1, cursor: "pointer" }}
                    />
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", slide.imageOffsetY + 2)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
                        background: "#141414", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)",
                      }}
                      title="Move image down"
                    >
                      &#x25BC;
                    </button>
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", 0)}
                      style={{
                        background: "none", border: "none", color: BRAND, fontSize: "0.7rem",
                        fontWeight: 600, cursor: "pointer", padding: "0.2rem",
                      }}
                      title="Reset position"
                    >
                      Reset
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  value={slide.headline.replace(/\n/g, "\\n")}
                  onChange={(e) => updateSlide(idx, "headline", e.target.value.replace(/\\n/g, "\n"))}
                  placeholder="Headline (use \n for line break)"
                  style={{
                    width: "100%",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="text"
                  value={slide.subtitle}
                  onChange={(e) => updateSlide(idx, "subtitle", e.target.value)}
                  placeholder="Subtitle"
                  style={{
                    width: "100%",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: "0.8rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: "2rem",
          padding: "1.25rem",
          background: "#141414",
          borderRadius: "0.75rem",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.7,
        }}>
          <strong style={{ color: "#e8e8e8" }}>How to use:</strong>
          <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
            <li>Take screenshots on your iPhone (or simulator) of the 6 screens you want</li>
            <li>Upload each screenshot to its slot above</li>
            <li>Edit the headline and subtitle text for each</li>
            <li>Pick your background, text color, and device size from the top bar</li>
            <li>Click <strong>&quot;Export All PNGs&quot;</strong> to download all 6 at the correct App Store resolution</li>
            <li>You can also click any individual preview to export just that one</li>
            <li>Upload to App Store Connect under <strong>App Previews and Screenshots</strong></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

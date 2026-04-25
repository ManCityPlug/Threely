"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

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
  imageOffsetY: number;
}

const DEFAULT_SLIDES: Slide[] = [
  { id: "1", image: null, headline: "Your goals, broken into\n3 daily tasks", subtitle: "AI builds your personalized plan", imageOffsetY: 0 },
  { id: "2", image: null, headline: "AI-powered coaching\nfor every task", subtitle: "Ask AI anything about your tasks", imageOffsetY: 0 },
  { id: "3", image: null, headline: "Track all your goals\nin one place", subtitle: "Stay organized and focused", imageOffsetY: 0 },
  { id: "4", image: null, headline: "Start for\n$1", subtitle: "No commitment required", imageOffsetY: 0 },
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
        ctx.fillStyle = "#635BFF";
      }
      ctx.fillRect(0, 0, W, H);

      const textY = W * 0.05;
      const headlineSize = Math.round(W * 0.062);
      const subtitleSize = Math.round(W * 0.032);
      const headlineLines = slide.headline.split("\n");

      if (slide.image) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = slide.image!;
        });

        if (showDevice) {
          const phoneW = W * 0.82;
          const phoneH = phoneW * (img.height / img.width);
          const phoneX = (W - phoneW) / 2;
          const yOffset = (slide.imageOffsetY / 100) * phoneH;
          const phoneY = H - phoneH + yOffset;
          const cornerR = phoneW * 0.07;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 60;
          ctx.shadowOffsetY = 20;

          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.fillStyle = "#000";
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.clip();
          ctx.drawImage(img, phoneX, phoneY, phoneW, phoneH);
          ctx.restore();

          ctx.beginPath();
          ctx.roundRect(phoneX, phoneY, phoneW, phoneH, cornerR);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          const imgW = W * 0.9;
          const imgH = imgW * (img.height / img.width);
          const imgX = (W - imgW) / 2;
          const yOffset = (slide.imageOffsetY / 100) * imgH;
          const imgY = H - imgH + yOffset;
          ctx.drawImage(img, imgX, imgY, imgW, imgH);
        }
      }

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
    <div className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <h1 className="text-base font-bold tracking-tight text-neutral-900">
            Screenshot Generator
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sizeIdx}
              onChange={(e) => setSizeIdx(Number(e.target.value))}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            >
              {SIZES.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={bgIdx}
              onChange={(e) => setBgIdx(Number(e.target.value))}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            >
              {BG_OPTIONS.map((b, i) => (
                <option key={i} value={i}>
                  {b.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              Text:
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border border-neutral-200"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={showDevice}
                onChange={(e) => setShowDevice(e.target.checked)}
              />
              Device frame
            </label>

            <Button
              variant="gold"
              size="sm"
              onClick={exportAll}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export All PNGs"}
            </Button>
          </div>
        </div>
      </div>

      {/* Slides grid */}
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
            >
              {/* Preview — keep dynamic background as inline style; behavior preserved */}
              <div
                onClick={() => exportOne(idx)}
                title="Click to export this screenshot"
                style={{ aspectRatio: `${size.w} / ${size.h}`, background: bg }}
                className="relative flex cursor-pointer flex-col items-center overflow-hidden"
              >
                <div className="relative z-10 px-4 pt-[5%] text-center">
                  <div
                    className="text-[clamp(1rem,2.5vw,1.4rem)] font-extrabold leading-tight tracking-tight whitespace-pre-line"
                    style={{ color: textColor }}
                  >
                    {slide.headline}
                  </div>
                  <div
                    className="mt-1.5 text-[clamp(0.6rem,1.2vw,0.75rem)] font-medium opacity-80"
                    style={{ color: textColor }}
                  >
                    {slide.subtitle}
                  </div>
                </div>

                {slide.image && (
                  <div className="flex w-full flex-1 items-end justify-center p-2 pb-0">
                    <div
                      className={`overflow-hidden ${
                        showDevice
                          ? "rounded-[clamp(12px,3vw,24px)] border-2 border-white/20 shadow-2xl"
                          : ""
                      }`}
                      style={{
                        width: showDevice ? "82%" : "90%",
                        lineHeight: 0,
                        transform: `translateY(${slide.imageOffsetY}%)`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.image}
                        alt=""
                        className="block w-full"
                      />
                    </div>
                  </div>
                )}

                {!slide.image && (
                  <div
                    className="flex flex-1 items-center justify-center text-sm font-semibold opacity-50"
                    style={{ color: textColor }}
                  >
                    Upload a screenshot below
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <span className="min-w-[18px] text-xs font-bold text-gold">
                    #{idx + 1}
                  </span>
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400">
                    {slide.image ? "Replace image" : "Upload screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(idx, e)}
                      className="hidden"
                    />
                  </label>
                  {slide.image && (
                    <button
                      onClick={() => updateSlide(idx, "image", null)}
                      className="px-1 text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {slide.image && (
                  <div className="flex items-center gap-2">
                    <span className="min-w-[54px] text-xs font-semibold text-neutral-600">
                      Position:
                    </span>
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", slide.imageOffsetY - 2)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm font-bold text-neutral-600 hover:bg-neutral-50"
                      title="Move image up"
                    >
                      &#x25B2;
                    </button>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={slide.imageOffsetY}
                      onChange={(e) =>
                        updateSlide(idx, "imageOffsetY", Number(e.target.value))
                      }
                      className="flex-1 cursor-pointer"
                    />
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", slide.imageOffsetY + 2)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm font-bold text-neutral-600 hover:bg-neutral-50"
                      title="Move image down"
                    >
                      &#x25BC;
                    </button>
                    <button
                      onClick={() => updateSlide(idx, "imageOffsetY", 0)}
                      className="px-1 text-xs font-semibold text-gold hover:text-gold/80"
                      title="Reset position"
                    >
                      Reset
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  value={slide.headline.replace(/\n/g, "\\n")}
                  onChange={(e) =>
                    updateSlide(idx, "headline", e.target.value.replace(/\\n/g, "\n"))
                  }
                  placeholder="Headline (use \n for line break)"
                  className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                />
                <input
                  type="text"
                  value={slide.subtitle}
                  onChange={(e) => updateSlide(idx, "subtitle", e.target.value)}
                  placeholder="Subtitle"
                  className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-sm leading-relaxed text-neutral-600">
          <strong className="text-neutral-900">How to use:</strong>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Take screenshots on your iPhone (or simulator) of the 6 screens you want</li>
            <li>Upload each screenshot to its slot above</li>
            <li>Edit the headline and subtitle text for each</li>
            <li>Pick your background, text color, and device size from the top bar</li>
            <li>
              Click <strong>&quot;Export All PNGs&quot;</strong> to download all 6 at the correct App Store resolution
            </li>
            <li>You can also click any individual preview to export just that one</li>
            <li>
              Upload to App Store Connect under <strong>App Previews and Screenshots</strong>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

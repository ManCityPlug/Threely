"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DfyType } from "./DfyButton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DfyModalProps {
  type: DfyType;
  taskText: string;
  onClose: () => void;
  onDelivered?: () => void;
}

type ModalState = "idle" | "generating" | "result" | "error";

interface ProductImage { variant: string; url: string; alt: string }
interface Product {
  id: string;
  title: string;
  niches: string[];
  supplier_cost: number;
  suggested_retail: number;
  why_it_sells: string;
  tags: string[];
  image_variants: ProductImage[];
}
interface ComposedLogo {
  pngBase64: string;
  svg: string;
  iconId: string;
  paletteId: string;
  fontId: string;
}

// ─── Niche storage ────────────────────────────────────────────────────────────

const NICHE_KEY = "threely_dfy_niche";
const BUSINESS_KEY = "threely_dfy_business_name";

const PRODUCT_NICHES = [
  { value: "fitness", label: "Fitness" },
  { value: "beauty", label: "Beauty" },
  { value: "tech_accessories", label: "Tech Accessories" },
  { value: "home_decor", label: "Home Decor" },
  { value: "pet", label: "Pet" },
  { value: "kids", label: "Kids" },
  { value: "eco", label: "Eco / Sustainable" },
  { value: "wellness", label: "Wellness" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DfyModal({ type, taskText, onClose, onDelivered }: DfyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<string>("");

  // Inputs (persisted across sessions)
  const [keyword, setKeyword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [productNiche, setProductNiche] = useState<string>("fitness");

  // Results
  const [names, setNames] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [logos, setLogos] = useState<ComposedLogo[]>([]);

  // Theater state
  const [theaterStep, setTheaterStep] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const savedNiche = localStorage.getItem(NICHE_KEY);
      if (savedNiche) setKeyword(savedNiche);
      const savedBiz = localStorage.getItem(BUSINESS_KEY);
      if (savedBiz) setBusinessName(savedBiz);
    } catch { /* ignore */ }
  }, []);

  async function callApi<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const { getSupabase } = await import("@/lib/supabase-client");
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function runGeneration() {
    setError("");
    setState("generating");
    setTheaterStep(0);

    // Theater progress
    const theaterInterval = setInterval(() => {
      setTheaterStep((s) => Math.min(s + 1, 3));
    }, 700);

    try {
      if (type === "names") {
        if (!keyword.trim()) throw new Error("Tell us your niche first");
        localStorage.setItem(NICHE_KEY, keyword.trim());
        const data = await callApi<{ names: string[] }>("/api/dfy/names", { keyword: keyword.trim(), count: 5 });
        await minDelay(1800);
        setNames(data.names || []);
      } else if (type === "products") {
        const data = await callApi<{ products: Product[] }>("/api/dfy/products", { niches: [productNiche], count: 3 });
        await minDelay(2200);
        setProducts(data.products || []);
      } else if (type === "logo") {
        if (!businessName.trim()) throw new Error("Tell us your business name first");
        localStorage.setItem(BUSINESS_KEY, businessName.trim());
        const data = await callApi<{ logos: ComposedLogo[] }>("/api/dfy/logo", { businessName: businessName.trim(), batch: true });
        await minDelay(2400);
        setLogos(data.logos || []);
      }
      clearInterval(theaterInterval);
      setState("result");
    } catch (e: unknown) {
      clearInterval(theaterInterval);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setState("error");
    }
  }

  if (!mounted) return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.75rem",
          borderRadius: 18,
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#D4A843", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              Do it for me
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1.3 }}>
              {headerTitle(type)}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, fontSize: 20, lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Task context */}
        <div style={{ fontSize: "0.82rem", color: "var(--subtext)", marginBottom: 18, fontStyle: "italic" }}>
          &ldquo;{taskText}&rdquo;
        </div>

        {/* ─── Idle state: inputs ─── */}
        {state === "idle" && (
          <div>
            {type === "names" && (
              <NicheInput
                value={keyword}
                onChange={setKeyword}
                label="What's your niche or main keyword?"
                placeholder="e.g. coffee, yoga, candles"
              />
            )}
            {type === "logo" && (
              <NicheInput
                value={businessName}
                onChange={setBusinessName}
                label="What's your business name?"
                placeholder="e.g. The Coffee Edit"
              />
            )}
            {type === "products" && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>What niche?</label>
                <select
                  value={productNiche}
                  onChange={(e) => setProductNiche(e.target.value)}
                  style={inputStyle}
                >
                  {PRODUCT_NICHES.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={runGeneration}
              style={goldButtonStyle}
            >
              {ctaText(type)}
            </button>
          </div>
        )}

        {/* ─── Generating theater ─── */}
        {state === "generating" && (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✨</div>
            <div style={{ color: "var(--text)", fontSize: "0.95rem", fontWeight: 600 }}>
              {theaterText(type, theaterStep)}
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: i <= theaterStep ? "#D4A843" : "var(--border)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ─── Result ─── */}
        {state === "result" && type === "names" && (
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtext)", marginBottom: 10 }}>
              Tap any name to copy:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {names.map((n, i) => (
                <CopyCard key={i} text={n} />
              ))}
            </div>
            <button onClick={runGeneration} style={secondaryButtonStyle}>
              Generate 5 more
            </button>
            <button onClick={() => { onDelivered?.(); onClose(); }} style={goldButtonStyle}>
              Done
            </button>
          </div>
        )}

        {state === "result" && type === "logo" && (
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtext)", marginBottom: 10 }}>
              Tap any logo to download:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {logos.map((l, i) => (
                <LogoCard key={i} logo={l} businessName={businessName.trim()} />
              ))}
            </div>
            <button onClick={runGeneration} style={secondaryButtonStyle}>
              Generate 6 more
            </button>
            <button onClick={() => { onDelivered?.(); onClose(); }} style={goldButtonStyle}>
              Done
            </button>
          </div>
        )}

        {state === "result" && type === "products" && (
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtext)", marginBottom: 10 }}>
              Top picks for {PRODUCT_NICHES.find((n) => n.value === productNiche)?.label}:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <button onClick={runGeneration} style={secondaryButtonStyle}>
              Pick 3 more
            </button>
            <button onClick={() => { onDelivered?.(); onClose(); }} style={goldButtonStyle}>
              Done
            </button>
          </div>
        )}

        {/* ─── Error ─── */}
        {state === "error" && (
          <div style={{ padding: "12px 0" }}>
            <div style={{ color: "#ff6b6b", fontSize: "0.9rem", marginBottom: 16 }}>
              {error}
            </div>
            <button onClick={() => setState("idle")} style={secondaryButtonStyle}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NicheInput({ value, onChange, label, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        maxLength={30}
      />
    </div>
  );
}

function CopyCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch { /* ignore */ }
      }}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--bg-elevated, #f8fafc)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        fontSize: "0.95rem",
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(212,168,67,0.08)";
        e.currentTarget.style.borderColor = "rgba(212,168,67,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated, #f8fafc)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <span>{text}</span>
      <span style={{ fontSize: "0.72rem", color: copied ? "#D4A843" : "var(--muted)", fontWeight: 700 }}>
        {copied ? "COPIED" : "COPY"}
      </span>
    </button>
  );
}

function LogoCard({ logo, businessName }: { logo: ComposedLogo; businessName: string }) {
  function download() {
    try {
      const link = document.createElement("a");
      link.href = logo.pngBase64;
      link.download = `${businessName.replace(/\s+/g, "_").toLowerCase() || "logo"}_${logo.iconId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch { /* ignore */ }
  }
  return (
    <button
      onClick={download}
      style={{
        padding: 0,
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        background: "transparent",
        aspectRatio: "1",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(212,168,67,0.6)"; e.currentTarget.style.transform = "scale(1.02)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "scale(1)"; }}
      aria-label="Download logo"
    >
      <img
        src={logo.pngBase64}
        alt={`${businessName} logo`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </button>
  );
}

function ProductCard({ product }: { product: Product }) {
  const img = product.image_variants[0];
  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: 12,
      borderRadius: 10,
      background: "var(--bg-elevated, #f8fafc)",
      border: "1px solid var(--border)",
    }}>
      {img && (
        <img
          src={img.url}
          alt={img.alt}
          style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "var(--border)" }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
          {product.title}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--subtext)", lineHeight: 1.4, marginBottom: 4 }}>
          {product.why_it_sells}
        </div>
        <div style={{ fontSize: "0.78rem", color: "#D4A843", fontWeight: 700 }}>
          Cost ${product.supplier_cost} → Sell ${product.suggested_retail}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headerTitle(type: DfyType): string {
  if (type === "names") return "We'll pick your business name";
  if (type === "logo") return "We'll design your logo";
  if (type === "products") return "We'll pick a top-performing product";
  return "";
}

function ctaText(type: DfyType): string {
  if (type === "names") return "Generate 5 names";
  if (type === "logo") return "Design my logo";
  if (type === "products") return "Pick 3 products";
  return "Go";
}

function theaterText(type: DfyType, step: number): string {
  if (type === "names") {
    return ["Finding name ideas for your niche...", "Checking for clean, brandable options...", "Picking your top 5..."][Math.min(step, 2)];
  }
  if (type === "logo") {
    return ["Designing your logo...", "Choosing the right colors and font...", "Finalizing your logo..."][Math.min(step, 2)];
  }
  if (type === "products") {
    return ["Scanning trending products...", "Checking supplier pricing...", "Picking your top 3..."][Math.min(step, 2)];
  }
  return "Working on it...";
}

function minDelay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--subtext)",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "var(--bg-elevated, #f8fafc)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  outline: "none",
};

const goldButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 20px",
  marginTop: 12,
  borderRadius: 10,
  background: "#D4A843",
  color: "#000",
  fontSize: "0.95rem",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 20px",
  marginTop: 12,
  borderRadius: 10,
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.88rem",
  fontWeight: 600,
  border: "1px solid var(--border)",
  cursor: "pointer",
};

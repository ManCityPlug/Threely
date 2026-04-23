import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dfyApi, type DfyProduct, type DfyLogo } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export type DfyType = "names" | "products" | "logo";

export function detectDfyType(taskText: string): DfyType | null {
  const t = taskText.toLowerCase();
  if (/\bbusiness name\b|\bstore name\b|\bbrand name\b|\bname the (business|store|brand)\b/.test(t)) return "names";
  if (/\blogo\b/.test(t)) return "logo";
  if (/pick a product|choose a product|pick a top|top-performing product/.test(t)) return "products";
  return null;
}

const GOLD = "#D4A843";
const NICHE_KEY = "threely_dfy_niche";
const BUSINESS_KEY = "threely_dfy_business_name";

const PRODUCT_NICHES: { value: string; label: string }[] = [
  { value: "fitness", label: "Fitness" },
  { value: "beauty", label: "Beauty" },
  { value: "tech_accessories", label: "Tech" },
  { value: "home_decor", label: "Home Decor" },
  { value: "pet", label: "Pet" },
  { value: "kids", label: "Kids" },
  { value: "eco", label: "Eco" },
  { value: "wellness", label: "Wellness" },
];

type ModalState = "idle" | "generating" | "result" | "error";

interface Props {
  visible: boolean;
  type: DfyType;
  taskText: string;
  onClose: () => void;
  onDelivered?: () => void;
}

export default function DfyModal({ visible, type, taskText, onClose, onDelivered }: Props) {
  const { colors } = useTheme();

  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [productNiche, setProductNiche] = useState("fitness");
  const [names, setNames] = useState<string[]>([]);
  const [products, setProducts] = useState<DfyProduct[]>([]);
  const [logos, setLogos] = useState<DfyLogo[]>([]);
  const [theaterStep, setTheaterStep] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setState("idle");
    setError("");
    (async () => {
      try {
        const savedNiche = await AsyncStorage.getItem(NICHE_KEY);
        if (savedNiche) setKeyword(savedNiche);
        const savedBiz = await AsyncStorage.getItem(BUSINESS_KEY);
        if (savedBiz) setBusinessName(savedBiz);
      } catch { /* ignore */ }
    })();
  }, [visible]);

  async function runGeneration() {
    setError("");
    setState("generating");
    setTheaterStep(0);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const theaterInterval = setInterval(() => {
      setTheaterStep((s) => Math.min(s + 1, 3));
    }, 700);

    try {
      if (type === "names") {
        if (!keyword.trim()) throw new Error("Tell us your niche first");
        await AsyncStorage.setItem(NICHE_KEY, keyword.trim());
        const data = await dfyApi.names(keyword.trim(), 5);
        await minDelay(1800);
        setNames(data.names || []);
      } else if (type === "products") {
        const data = await dfyApi.products([productNiche], 3);
        await minDelay(2200);
        setProducts(data.products || []);
      } else if (type === "logo") {
        if (!businessName.trim()) throw new Error("Tell us your business name first");
        await AsyncStorage.setItem(BUSINESS_KEY, businessName.trim());
        const data = await dfyApi.logo(businessName.trim(), true);
        await minDelay(2400);
        setLogos(data.logos || []);
      }
      clearInterval(theaterInterval);
      setState("result");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      clearInterval(theaterInterval);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setState("error");
    }
  }

  async function shareText(text: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: text });
    } catch { /* ignore user cancel */ }
  }

  async function shareLogo(logo: DfyLogo) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Share the data URI — iOS share sheet offers "Save Image", Copy, etc.
      await Share.share({ url: logo.pngBase64, message: businessName.trim() });
    } catch { /* ignore user cancel */ }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "center",
        padding: 16,
      }}>
        <View style={{
          maxHeight: "90%",
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 22,
        }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD, letterSpacing: 1.2, marginBottom: 4 }}>
                DO IT FOR ME
              </Text>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3, lineHeight: 22 }}>
                {headerTitle(type)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 22, lineHeight: 22 }}>{"✕"}</Text>
            </TouchableOpacity>
          </View>

          {/* Task context */}
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, fontStyle: "italic" }}>
            &ldquo;{taskText}&rdquo;
          </Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {state === "idle" && (
              <View>
                {type === "names" && (
                  <NicheField
                    colors={colors}
                    value={keyword}
                    onChange={setKeyword}
                    label="What's your niche or main keyword?"
                    placeholder="e.g. coffee, yoga, candles"
                  />
                )}
                {type === "logo" && (
                  <NicheField
                    colors={colors}
                    value={businessName}
                    onChange={setBusinessName}
                    label="What's your business name?"
                    placeholder="e.g. The Coffee Edit"
                  />
                )}
                {type === "products" && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 }}>
                      What niche?
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {PRODUCT_NICHES.map((n) => {
                        const active = n.value === productNiche;
                        return (
                          <TouchableOpacity
                            key={n.value}
                            onPress={() => setProductNiche(n.value)}
                            style={{
                              paddingVertical: 8,
                              paddingHorizontal: 14,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: active ? GOLD : colors.border,
                              backgroundColor: active ? "rgba(212,168,67,0.12)" : "transparent",
                            }}
                          >
                            <Text style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: active ? GOLD : colors.textSecondary,
                            }}>
                              {n.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                <PrimaryButton label={ctaText(type)} onPress={runGeneration} />
              </View>
            )}

            {state === "generating" && (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 38, marginBottom: 10 }}>{"✨"}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
                  {theaterText(type, theaterStep)}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 18 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={{
                        width: 7, height: 7, borderRadius: 4,
                        backgroundColor: i <= theaterStep ? GOLD : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </View>
                <ActivityIndicator color={GOLD} style={{ marginTop: 16 }} />
              </View>
            )}

            {state === "result" && type === "names" && (
              <View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                  Tap any name to copy:
                </Text>
                {names.map((n, i) => (
                  <CopyCard key={i} colors={colors} text={n} onCopy={shareText} />
                ))}
                <SecondaryButton label="Generate 5 more" onPress={runGeneration} />
                <PrimaryButton label="Done" onPress={() => { onDelivered?.(); onClose(); }} />
              </View>
            )}

            {state === "result" && type === "products" && (
              <View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                  Top picks:
                </Text>
                {products.map((p) => (
                  <ProductCard key={p.id} colors={colors} product={p} />
                ))}
                <SecondaryButton label="Pick 3 more" onPress={runGeneration} />
                <PrimaryButton label="Done" onPress={() => { onDelivered?.(); onClose(); }} />
              </View>
            )}

            {state === "result" && type === "logo" && (
              <View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                  Tap a logo to save or share:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                  {logos.map((l, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => shareLogo(l)}
                      style={{
                        width: "48%",
                        aspectRatio: 1,
                        marginBottom: "4%",
                        borderRadius: 10,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Image source={{ uri: l.pngBase64 }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
                <SecondaryButton label="Generate 6 more" onPress={runGeneration} />
                <PrimaryButton label="Done" onPress={() => { onDelivered?.(); onClose(); }} />
              </View>
            )}

            {state === "error" && (
              <View style={{ paddingVertical: 8 }}>
                <Text style={{ color: "#ff6b6b", fontSize: 14, marginBottom: 14 }}>
                  {error}
                </Text>
                <SecondaryButton label="Try again" onPress={() => setState("idle")} />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

type ColorsShape = ReturnType<typeof useTheme>["colors"];

function NicheField({ colors, value, onChange, label, placeholder }: {
  colors: ColorsShape; value: string; onChange: (v: string) => void; label: string; placeholder: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={50}
        autoCapitalize="none"
        style={{
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          fontSize: 15,
          backgroundColor: "rgba(255,255,255,0.04)",
        }}
      />
    </View>
  );
}

function CopyCard({ colors, text, onCopy }: { colors: ColorsShape; text: string; onCopy: (t: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => { onCopy(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: "rgba(255,255,255,0.04)",
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, flex: 1, marginRight: 10 }} numberOfLines={1}>
        {text}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: "800", color: copied ? GOLD : colors.textTertiary }}>
        {copied ? "COPIED" : "COPY"}
      </Text>
    </TouchableOpacity>
  );
}

function ProductCard({ colors, product }: { colors: ColorsShape; product: DfyProduct }) {
  const img = product.image_variants[0];
  return (
    <View style={{
      flexDirection: "row",
      gap: 12,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "rgba(255,255,255,0.04)",
      marginBottom: 10,
    }}>
      {img && (
        <Image
          source={{ uri: img.url }}
          style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 2 }}>
          {product.title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginBottom: 4 }} numberOfLines={2}>
          {product.why_it_sells}
        </Text>
        <Text style={{ fontSize: 12, color: GOLD, fontWeight: "800" }}>
          Cost ${product.supplier_cost} → Sell ${product.suggested_retail}
        </Text>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: GOLD,
        alignItems: "center",
        marginTop: 10,
      }}
    >
      <Text style={{ color: "#000", fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        marginTop: 10,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headerTitle(type: DfyType): string {
  if (type === "names") return "We'll pick your business name";
  if (type === "logo") return "We'll design your logo";
  if (type === "products") return "We'll pick a top product";
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

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { spacing, typography, radius } from "@/constants/theme";
import {
  useGoogleSignIn,
  useAppleSignIn,
  isAppleSignInAvailable,
} from "@/lib/auth-providers";

const PRIMARY = "#635BFF";

const FORM_MAX_WIDTH = 420;

export default function LoginScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 600;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function startCooldown() {
    setCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleForgotPassword() {
    const trimmed = (forgotEmail || email).trim();
    if (!trimmed) return;
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: "https://threely.co/reset-password",
      });
      if (error) {
        Alert.alert("Reset failed", error.message);
        return;
      }
      setForgotSent(true);
      setForgotEmail(trimmed);
      startCooldown();
    } catch {
      Alert.alert("Reset failed", "Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  const { promptAsync: googlePromptAsync, loading: googleLoading } = useGoogleSignIn();
  const { signIn: appleSignIn, loading: appleLoading } = useAppleSignIn();
  const socialLoading = googleLoading || appleLoading;

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Check if the email exists to show a more helpful message
        try {
          const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(`${BASE_URL}/api/auth/check-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            const text = await res.text();
            let data: { exists?: boolean };
            try { data = JSON.parse(text); } catch { data = {}; }
            if (data.exists === false) {
              Alert.alert(
                "Account not found",
                "We couldn't find an account with this email. Try creating an account instead.",
                [{ text: "OK" }]
              );
              return;
            }
          }
        } catch {
          // If check fails (timeout, network error), fall through to generic error
        }
        Alert.alert("Login failed", "Invalid login credentials");
      }
    } catch {
      Alert.alert("Login failed", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a0a", "#0a0a0a", "#0a0a0a"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.inner,
            isWideScreen && { maxWidth: FORM_MAX_WIDTH, alignSelf: "center", width: "100%" },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Image
            source={require("@/assets/icon.png")}
            style={styles.logo}
          />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Threely account</Text>

          {/* Social sign-in buttons */}
          <View style={styles.socialButtons}>
            {isAppleSignInAvailable && (
              <Pressable
                style={[styles.appleButton, socialLoading && { opacity: 0.6 }]}
                onPress={appleSignIn}
                disabled={socialLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.googleButton, socialLoading && { opacity: 0.6 }]}
              onPress={() => googlePromptAsync()}
              disabled={socialLoading}
            >
              <Ionicons name="logo-google" size={20} color="#1F2937" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.35)"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.label}>Password</Text>
                <Pressable onPress={() => { setForgotEmail(email); setShowForgot(true); }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: typography.xs, fontWeight: typography.medium }}>
                    Forgot password?
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, passwordFocused && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.35)"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            <Pressable
              style={[styles.button, (loading || socialLoading) && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading || socialLoading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.replace("/(auth)/register")}>
              <Text style={styles.footerText}>
                Don't have an account? <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "600" as const }}>Create one</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot password modal */}
      <Modal visible={showForgot} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => { setShowForgot(false); setForgotSent(false); }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {forgotSent ? (
              <View style={{ alignItems: "center" }}>
                <View style={styles.successCircle}>
                  <Text style={{ color: "#4ade80", fontSize: 22, fontWeight: "700" }}>✓</Text>
                </View>
                <Text style={styles.modalTitle}>Check your email</Text>
                <Text style={styles.modalSubtitle}>
                  We sent a password reset link to{" "}
                  <Text style={{ fontWeight: "700", color: "#fff" }}>{forgotEmail}</Text>.
                  {"\n"}Click the link to set a new password.
                  {"\n\n"}
                  <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>Not seeing it? Check your spam folder.</Text>
                </Text>
                <Pressable
                  style={[styles.modalBtn, (cooldown > 0 || forgotLoading) && { opacity: 0.5 }]}
                  onPress={handleForgotPassword}
                  disabled={cooldown > 0 || forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#635BFF" size="small" />
                  ) : (
                    <Text style={styles.modalBtnText}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend reset link"}
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.modalBtnOutline}
                  onPress={() => { setShowForgot(false); setForgotSent(false); }}
                >
                  <Text style={styles.modalBtnOutlineText}>Back to sign in</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.modalTitle}>Reset your password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email and we'll send you a link to reset your password.
                </Text>
                <Text style={[styles.label, { marginBottom: spacing.xs }]}>Email</Text>
                <TextInput
                  style={[styles.input, { marginBottom: spacing.md }]}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={styles.modalBtnOutline}
                    onPress={() => setShowForgot(false)}
                  >
                    <Text style={styles.modalBtnOutlineText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, { flex: 1 }, forgotLoading && { opacity: 0.6 }]}
                    onPress={handleForgotPassword}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#635BFF" size="small" />
                    ) : (
                      <Text style={styles.modalBtnText}>Send reset link</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 24,
    left: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: spacing.xl,
    alignSelf: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: "rgba(255,255,255,0.8)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
    color: "#FFFFFF",
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginTop: spacing.sm,
  },
  buttonText: {
    color: "#000",
    fontSize: typography.base,
    fontWeight: typography.semibold,
    letterSpacing: -0.2,
  },
  footer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xl,
  },
  footerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: typography.xs,
    textAlign: "center",
  },
  socialButtons: {
    gap: 12,
    marginBottom: spacing.md,
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    height: 48,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    height: 48,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  googleButtonText: {
    color: "#1F2937",
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: typography.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: "#FFFFFF",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: typography.sm,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  modalBtn: {
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  modalBtnText: {
    color: "#000",
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  modalBtnOutline: {
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    flex: 1,
  },
  modalBtnOutlineText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
});

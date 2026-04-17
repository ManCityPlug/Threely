import { useState } from "react";
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
import { validatePassword } from "@/lib/validate-password";

const PRIMARY = "#635BFF";
const FORM_MAX_WIDTH = 420;

export default function RegisterScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > 600;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { promptAsync: googlePromptAsync, loading: googleLoading } = useGoogleSignIn();
  const { signIn: appleSignIn, loading: appleLoading } = useAppleSignIn();
  const socialLoading = googleLoading || appleLoading;

  async function handleRegister() {
    if (!email || !password) return;
    const pwError = validatePassword(password);
    if (pwError) {
      Alert.alert("Password doesn't meet requirements", `${pwError}.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        if (error.message.includes("already registered")) {
          Alert.alert("Account exists", "This email is already registered. Try signing in instead.");
        } else {
          Alert.alert("Sign up failed", error.message);
        }
      }
    } catch {
      Alert.alert("Sign up failed", "Something went wrong. Please try again.");
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
          <Image source={require("@/assets/icon.png")} style={styles.logo} />

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Start your free 7-day trial</Text>

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
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, passwordFocused && styles.inputFocused]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                placeholder="8+ chars, incl. uppercase, lowercase, number"
                placeholderTextColor="rgba(255,255,255,0.35)"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            <Pressable
              style={[styles.button, (loading || socialLoading) && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading || socialLoading}
            >
              {loading ? (
                <ActivityIndicator color="#635BFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerText}>
                Already have an account? <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "600" as const }}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    width: 56, height: 56, borderRadius: 14,
    marginBottom: spacing.xl, alignSelf: "center",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  title: {
    fontSize: typography.xxl, fontWeight: typography.bold,
    color: "#FFFFFF", letterSpacing: -0.5,
    textAlign: "center", marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base, color: "rgba(255,255,255,0.6)",
    textAlign: "center", marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  fieldGroup: { gap: spacing.xs },
  label: {
    fontSize: typography.sm, fontWeight: typography.medium,
    color: "rgba(255,255,255,0.8)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md, height: 48,
    paddingHorizontal: spacing.md, fontSize: typography.base,
    color: "#FFFFFF",
  },
  inputFocused: {
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  button: {
    height: 48, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF", marginTop: spacing.sm,
  },
  buttonText: {
    color: "#000", fontSize: typography.base,
    fontWeight: typography.semibold, letterSpacing: -0.2,
  },
  footer: {
    justifyContent: "center", alignItems: "center",
    marginTop: spacing.xl,
  },
  footerText: {
    color: "rgba(255,255,255,0.5)", fontSize: typography.sm,
    textAlign: "center",
  },
  socialButtons: { gap: 12, marginBottom: spacing.md },
  appleButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#000000", height: 48, borderRadius: radius.md, gap: spacing.sm,
  },
  appleButtonText: {
    color: "#FFFFFF", fontSize: typography.base, fontWeight: typography.semibold,
  },
  googleButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF", height: 48, borderRadius: radius.md, gap: spacing.sm,
  },
  googleButtonText: {
    color: "#1F2937", fontSize: typography.base, fontWeight: typography.semibold,
  },
  divider: {
    flexDirection: "row", alignItems: "center",
    gap: spacing.md, marginBottom: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  dividerText: { color: "rgba(255,255,255,0.5)", fontSize: typography.sm },
});

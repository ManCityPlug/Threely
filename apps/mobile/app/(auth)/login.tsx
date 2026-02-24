import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/lib/theme";
import type { Colors } from "@/constants/theme";
import { spacing, typography, radius } from "@/constants/theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>3</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Threely account</Text>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
          />

          <Button
            title="Sign in"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register">
            <Text style={styles.footerLink}>Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    inner: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    logo: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
      alignSelf: "center",
    },
    logoText: {
      color: c.primaryText,
      fontSize: typography.xxl,
      fontWeight: typography.bold,
    },
    title: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: c.text,
      letterSpacing: -0.5,
      textAlign: "center",
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: typography.base,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: spacing.xl,
    },
    form: {
      gap: spacing.md,
    },
    button: {
      marginTop: spacing.sm,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing.xl,
    },
    footerText: {
      color: c.textSecondary,
      fontSize: typography.sm,
    },
    footerLink: {
      color: c.primary,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
    },
  });
}

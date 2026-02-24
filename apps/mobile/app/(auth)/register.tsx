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

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRegister() {
    if (!email || !password) return;
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{"\n"}
          <Text style={{ color: colors.primary }}>{email}</Text>
        </Text>
      </View>
    );
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
        <View style={styles.logo}>
          <Text style={styles.logoText}>3</Text>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start turning your goals into action</Text>

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
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />

          <Button
            title="Create account"
            onPress={handleRegister}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text style={styles.footerLink}>Sign in</Text>
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
    center: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
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
    checkmark: {
      fontSize: 48,
      color: c.success,
      marginBottom: spacing.lg,
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
      lineHeight: 22,
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

import { useState, useEffect } from "react";
import { Platform, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Complete any pending auth sessions (required for expo-auth-session)
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs (public — safe to embed)
const GOOGLE_WEB_CLIENT_ID =
  "782488743895-jh3lp82fu14qsqmi3i03qlvduv4ak3fp.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "782488743895-vmr1j19d74u3cj1vdt7vhf6ta4gq2vn5.apps.googleusercontent.com";

// ── Google Sign-In ─────────────────────────────────────────────────────────────

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false);

  // Let expo-auth-session compute the correct redirectUri per environment:
  // - Expo Go: uses the Expo auth proxy automatically
  // - Standalone iOS: uses reversed iOS client ID scheme
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      if (id_token) {
        setLoading(true);
        supabase.auth
          .signInWithIdToken({ provider: "google", token: id_token })
          .then(({ error }) => {
            if (error) Alert.alert("Sign-in failed", error.message);
          })
          .catch((e) => {
            Alert.alert("Sign-in failed", e?.message ?? "An unexpected error occurred");
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [response]);

  return {
    promptAsync: () => promptAsync(),
    loading,
    ready: !!request,
  };
}

// ── Apple Sign-In ──────────────────────────────────────────────────────────────

export const isAppleSignInAvailable = Platform.OS === "ios";

export function useAppleSignIn() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    try {
      setLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }

      // Apple only provides the name on the FIRST sign-in — capture it now
      const givenName = credential.fullName?.givenName;
      const familyName = credential.fullName?.familyName;
      const appleName = [givenName, familyName].filter(Boolean).join(" ");
      if (appleName) {
        await AsyncStorage.setItem("@threely_nickname", appleName);
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) throw error;

      // Also update Supabase user metadata with the name
      if (appleName) {
        await supabase.auth.updateUser({
          data: { full_name: appleName, display_name: appleName },
        });
      }
    } catch (e: any) {
      // Don't show error if user cancelled
      if (e.code !== "ERR_CANCELED") {
        Alert.alert("Sign-in failed", e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return { signIn, loading };
}

/**
 * First-launch landing. Shown when no profile is on disk.
 *
 * Sign-in providers:
 *   - Google (live — uses expo-auth-session)
 *   - Apple (placeholder, pending Apple Developer Program)
 *   - Guest (name-only fallback, AsyncStorage local-only)
 */
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "../store/profile";
import { useGoogleSignIn } from "../lib/auth";

const COLORS = {
  bg: "#0b1014",
  bgRow: "#161c22",
  bgElevated: "#10161c",
  text: "#f0f4f8",
  textDim: "#8a96a4",
  textFaint: "#54616f",
  border: "#222a32",
  accent: "#2dd4a3",
};

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const saveProfile = useProfile((s) => s.saveProfile);
  const signedIn = useProfile((s) => s.signedIn);
  const google = useGoogleSignIn();

  const [name, setName] = useState("");
  const [showGuest, setShowGuest] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (signedIn) router.replace("/");
  }, [signedIn, router]);

  useEffect(() => {
    if (google.error) {
      Alert.alert("Google sign-in failed", google.error);
      google.clearError();
    }
  }, [google.error, google]);

  const startGuest = async () => {
    if (!name.trim()) {
      Alert.alert("Pick a name", "Anything you'd like to be called.");
      return;
    }
    setBusy(true);
    await saveProfile({ displayName: name });
    setBusy(false);
    router.replace("/");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="home-outline" size={48} color={COLORS.accent} />
            </View>
            <Text style={styles.brand}>Inspect AI</Text>
            <Text style={styles.tagline}>
              Florida 4-Point and Wind Mitigation inspections,
              guided by Claude.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to continue</Text>
            <Text style={styles.cardHint}>
              Inspections sync to your account so you can pick up where
              you left off on any device.
            </Text>

            <View style={[styles.providerBtn, styles.providerOff]}>
              <Ionicons name="logo-apple" size={20} color={COLORS.text} style={styles.providerIcon} />
              <Text style={styles.providerText}>Sign in with Apple</Text>
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>SOON</Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.providerBtn,
                styles.providerGoogle,
                (!google.ready || google.signingIn) && styles.providerOff,
                { marginTop: 8 },
              ]}
              disabled={!google.ready || google.signingIn}
              onPress={() => void google.promptAsync()}
            >
              <Text style={[styles.providerIcon, styles.providerGoogleIcon]}>G</Text>
              <Text style={[styles.providerText, styles.providerGoogleText]}>
                {google.signingIn ? "Signing in…" : "Sign in with Google"}
              </Text>
            </Pressable>
          </View>

          {!showGuest ? (
            <Pressable onPress={() => setShowGuest(true)} style={styles.guestToggle}>
              <Text style={styles.guestToggleText}>
                Continue as guest →
              </Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Continue as guest</Text>
              <Text style={styles.cardHint}>
                Inspections stay on this device only. You can sign in
                any time to back them up.
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={COLORS.textFaint}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={startGuest}
              />
              <Pressable
                style={[styles.guestBtn, (busy || !name.trim()) && styles.providerOff]}
                disabled={busy || !name.trim()}
                onPress={startGuest}
              >
                <Text style={styles.guestBtnText}>
                  {busy ? "Saving…" : "Continue as guest"}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },

  hero: { alignItems: "center", marginTop: 32, marginBottom: 4 },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: "800",
    marginTop: 16,
    letterSpacing: -0.5,
  },
  tagline: {
    color: COLORS.textDim,
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 21,
  },

  card: {
    backgroundColor: COLORS.bgElevated,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardHint: { color: COLORS.textDim, fontSize: 12, lineHeight: 18, marginBottom: 12 },

  input: {
    backgroundColor: COLORS.bgRow,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
  },

  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.bgRow,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  providerOff: { opacity: 0.5 },
  providerIcon: { width: 22, textAlign: "center" },
  providerText: { color: COLORS.text, fontSize: 14, fontWeight: "600", flex: 1 },
  providerGoogle: { backgroundColor: "#fff", borderColor: "#fff" },
  providerGoogleIcon: {
    color: "#4285F4",
    fontWeight: "800",
    fontSize: 18,
  },
  providerGoogleText: { color: "#1f1f1f" },

  soonBadge: {
    backgroundColor: "#f6c34a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soonBadgeText: { color: "#000", fontWeight: "800", fontSize: 9, letterSpacing: 1 },

  guestToggle: { paddingVertical: 10, alignItems: "center" },
  guestToggleText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  guestBtn: {
    marginTop: 12,
    backgroundColor: COLORS.bgRow,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  guestBtnText: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
});

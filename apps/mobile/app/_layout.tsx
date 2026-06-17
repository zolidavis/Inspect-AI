import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initialsFor, useProfile } from "../store/profile";

/**
 * Small avatar circle in the top-right of the stack header. Tap →
 * /profile. Shows initials of the signed-in user (or "?").
 */
function HeaderAvatar() {
  const router = useRouter();
  const profile = useProfile((s) => s.profile);
  return (
    <Pressable
      onPress={() => router.push("/profile")}
      style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.6 }]}
      hitSlop={8}
    >
      <Text style={styles.avatarText}>{initialsFor(profile)}</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const hydrate = useProfile((s) => s.hydrate);
  const hydrated = useProfile((s) => s.hydrated);
  const signedIn = useProfile((s) => s.signedIn);
  const router = useRouter();
  const segments = useSegments();

  // One-time profile hydration from AsyncStorage on app start.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // After hydration, gate the app: if no profile, send to /welcome
  // (unless we're already there).
  useEffect(() => {
    if (!hydrated) return;
    const onWelcome = segments[0] === "welcome";
    if (!signedIn && !onWelcome) {
      router.replace("/welcome");
    }
  }, [hydrated, signedIn, segments, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: "600" },
          headerRight: () => <HeaderAvatar />,
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="index" options={{ title: "Inspections" }} />
        <Stack.Screen name="new" options={{ title: "New Inspection", presentation: "modal" }} />
        <Stack.Screen name="inspection/[id]" options={{ title: "Inspection" }} />
        <Stack.Screen name="inspection/[id]/camera" options={{ title: "Capture Photo" }} />
        <Stack.Screen name="inspection/[id]/suggestions" options={{ title: "AI Suggestions" }} />
        <Stack.Screen name="inspection/[id]/edit/four-point" options={{ title: "Edit 4-Point" }} />
        <Stack.Screen name="inspection/[id]/edit/wind-mit" options={{ title: "Edit Wind Mit" }} />
        <Stack.Screen name="inspection/[id]/report" options={{ title: "Report" }} />
        <Stack.Screen name="inspection/[id]/photos" options={{ title: "Manage Photos" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2dd4a3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#0b1014", fontWeight: "800", fontSize: 13 },
});

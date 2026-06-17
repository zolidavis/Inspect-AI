import { useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable,
  StyleSheet, Text, View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { colors } from "../../../lib/theme";

/**
 * Two modes — driven by whether the URL carries a `tag` query param:
 *
 *   `?tag=wm.roof_covering`  → tagged mode. Inspector picked the section
 *      in advance, every photo gets that tag, AI runs the tag-constrained
 *      analyze pass.
 *
 *   no `tag`                 → AUTO mode. Photo uploads with placeholder
 *      tag "auto" and the server runs classify + analyze in one call,
 *      returning the inferred section name back to the UI.
 */

const AUTO_PLACEHOLDER_TAG = "auto";

/** Human label for the classifier's inferred tag (mirrors PDF formatter). */
function prettyTag(tag: string): string {
  return tag
    .replace(/^wm\./, "Wind Mit · ")
    .replace(/^roof\./, "Roof · ")
    .replace(/^electrical\./, "Electrical · ")
    .replace(/^plumbing\./, "Plumbing · ")
    .replace(/^hvac\./, "HVAC · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Camera() {
  const { id, tag } = useLocalSearchParams<{ id: string; tag?: string }>();
  const isAuto = !tag;
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!permission) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission required.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  /**
   * Shared upload + AI tail. In auto mode we upload with a placeholder
   * tag then ask the server to classify + analyze in a single call.
   */
  const uploadAndAnalyze = async (uri: string): Promise<string | null> => {
    const uploadTag = isAuto ? AUTO_PLACEHOLDER_TAG : tag!;
    const uploaded = await api.uploadPhoto({
      inspectionId: id!,
      tag: uploadTag,
      uri,
    });
    try {
      if (isAuto) {
        const r = await api.autoAnalyzePhoto(uploaded.id);
        const label = prettyTag(r.classifiedAs);
        return `Classified as ${label}. ${r.summary ?? ""}`.trim();
      }
      const analysis = await api.analyzePhoto(uploaded.id);
      return analysis.summary;
    } catch {
      // Photo uploaded fine; AI analysis can fail without blocking.
      return "Photo uploaded (AI analysis unavailable).";
    }
  };

  const capture = async () => {
    if (!camRef.current || busy) return;
    setBusy(true); setStatusMsg(null);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error("no photo");
      setStatusMsg(isAuto ? "Classifying with AI…" : "Analyzing with AI…");
      const summary = await uploadAndAnalyze(photo.uri);
      setStatusMsg(summary);
    } catch (e: any) {
      Alert.alert("Capture failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    if (busy) return;
    setBusy(true); setStatusMsg(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 20,
      });
      if (result.canceled) return;
      const assets = result.assets ?? [];
      if (assets.length === 0) throw new Error("no assets selected");

      let okCount = 0;
      let lastSummary: string | null = null;
      for (let i = 0; i < assets.length; i++) {
        const uri = assets[i]!.uri;
        setStatusMsg(`Uploading ${i + 1} of ${assets.length}…`);
        try {
          const summary = await uploadAndAnalyze(uri);
          okCount++;
          if (summary) lastSummary = summary;
        } catch (err) {
          console.warn(`photo ${i + 1} upload failed:`, err);
        }
      }
      setStatusMsg(
        assets.length === 1
          ? (lastSummary ?? "Photo uploaded.")
          : `${okCount} of ${assets.length} uploaded. ${lastSummary ? "Last: " + lastSummary : ""}`,
      );
    } catch (e: any) {
      Alert.alert("Gallery upload failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView ref={camRef} style={{ flex: 1 }} facing="back" />
      <View style={styles.overlay}>
        <View style={styles.tagRow}>
          {isAuto ? (
            <>
              <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
              <Text style={styles.tag}>AI auto-tag</Text>
            </>
          ) : (
            <Text style={styles.tag}>{tag}</Text>
          )}
        </View>
        {statusMsg && <Text style={styles.aiText} numberOfLines={3}>{statusMsg}</Text>}
        <View style={styles.controls}>
          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Done</Text>
          </Pressable>
          <Pressable
            style={[styles.shutter, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={capture}
          >
            {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
          </Pressable>
          <Pressable
            style={[styles.secondary, styles.galleryBtn, busy && { opacity: 0.5 }]}
            disabled={busy}
            onPress={pickFromGallery}
          >
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={styles.galleryText}>Gallery</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  msg: { fontSize: 16, marginBottom: 12 },
  overlay: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: 16, backgroundColor: "rgba(0,0,0,0.45)",
  },
  tagRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8,
  },
  tag: { color: "#fff", fontWeight: "600" },
  aiText: { color: "#fff", marginBottom: 12, fontSize: 12 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shutter: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "rgba(255,255,255,0.6)",
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  secondary: {
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8, width: 80, alignItems: "center",
  },
  secondaryText: { color: "#fff", fontWeight: "600" },
  galleryBtn: {
    paddingVertical: 8,
    flexDirection: "column",
    gap: 2,
  },
  galleryText: { color: "#fff", fontWeight: "600", fontSize: 11 },
  button: { backgroundColor: colors.accent, padding: 12, borderRadius: 8 },
  buttonText: { color: colors.onAccent, fontWeight: "600" },
});

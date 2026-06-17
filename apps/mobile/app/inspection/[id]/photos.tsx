/**
 * Photo management — view + delete photos already attached to an inspection.
 *
 * Reached from the hub's Photos card ("Manage photos"). Lists every photo
 * grouped by its section tag, shows the thumbnail + AI summary, and lets the
 * inspector delete any photo (storage + DB). Works for both 4-Point and
 * Wind Mitigation inspections — it just renders whatever photos exist.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Photo } from "@inspect-ai/shared";
import { api } from "../../../lib/api";
import { colors, font } from "../../../lib/theme";

function prettyTag(tag: string): string {
  if (tag === "auto") return "Unsorted / auto";
  return tag
    .replace(/^wm\./, "Wind Mit · ")
    .replace(/^roof\./, "Roof · ")
    .replace(/^electrical\./, "Electrical · ")
    .replace(/^plumbing\./, "Plumbing · ")
    .replace(/^hvac\./, "HVAC · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Photos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.listPhotos(id!);
      // Newest first within the list.
      list.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
      setPhotos(list);
    } catch (e: any) {
      Alert.alert("Failed to load photos", e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload on focus so newly captured photos appear when returning here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (photo: Photo) => {
    Alert.alert("Delete photo?", "This removes it from the report permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(photo.id);
          try {
            await api.deletePhoto(photo.id);
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          } catch (e: any) {
            Alert.alert("Delete failed", e.message);
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Group by tag, preserving newest-first order within each group.
  const groups = new Map<string, Photo[]>();
  for (const p of photos) {
    const arr = groups.get(p.tag) ?? [];
    arr.push(p);
    groups.set(p.tag, arr);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Manage photos</Text>
      <Text style={styles.sub}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} attached. Tap a photo to delete it.
      </Text>

      <Pressable
        style={styles.addBtn}
        onPress={() => router.push(`/inspection/${id}/camera`)}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <Text style={styles.addBtnText}>Add more photos</Text>
      </Pressable>

      {photos.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={36} color={colors.textFaint} />
          <Text style={styles.emptyText}>No photos yet.</Text>
        </View>
      )}

      {[...groups.entries()].map(([tag, items]) => (
        <View key={tag} style={styles.group}>
          <Text style={styles.groupTitle}>
            {prettyTag(tag)} · {items.length}
          </Text>
          <View style={styles.grid}>
            {items.map((p) => (
              <Pressable
                key={p.id}
                style={styles.cell}
                onPress={() => confirmDelete(p)}
                disabled={deleting === p.id}
              >
                {p.url ? (
                  <Image source={{ uri: p.url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbMissing]}>
                    <Ionicons name="image-outline" size={28} color={colors.textFaint} />
                  </View>
                )}
                <View style={styles.delBadge}>
                  {deleting === p.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  )}
                </View>
                {p.aiAnalysis?.summary ? (
                  <Text style={styles.cellNote} numberOfLines={2}>
                    {p.aiAnalysis.summary}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const GAP = 10;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center" },
  h1: { color: colors.text, fontSize: 22, fontFamily: font.bold },
  sub: { color: colors.textDim, fontSize: 13, fontFamily: font.regular },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 14 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyText: { color: colors.textFaint, fontSize: 14, fontFamily: font.regular },
  group: { gap: 8 },
  groupTitle: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: font.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  cell: { width: "31%" },
  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbMissing: { alignItems: "center", justifyContent: "center" },
  delBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.danger,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cellNote: { color: colors.textFaint, fontSize: 9, marginTop: 2, fontFamily: font.regular },
});

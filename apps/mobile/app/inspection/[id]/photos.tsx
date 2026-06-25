/**
 * Photo management — view, re-tag, re-analyze, and delete the photos attached
 * to an inspection.
 *
 * Reached from the hub's Photos card ("View / edit photos"). Photos are
 * grouped by their section tag. Tapping a photo opens a full-size editor where
 * the inspector can:
 *   • view the photo large,
 *   • CORRECT the section (re-tag) when the AI auto-classifier guessed wrong —
 *     the server clears the stale analysis and we re-run AI for the new tag,
 *   • re-run AI analysis,
 *   • delete the photo.
 *
 * Works for both 4-Point and Wind Mitigation — the re-tag picker offers only
 * the sections valid for this inspection's type.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FourPoint, WindMit, type Inspection, type Photo } from "@inspect-ai/shared";
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

/** Section tags valid for re-tagging, given the inspection type. */
function sectionTags(type: Inspection["type"] | undefined): string[] {
  if (type === "four_point") return [...FourPoint.photoTags];
  if (type === "wind_mitigation") return [...WindMit.photoTags];
  return [...FourPoint.photoTags, ...WindMit.photoTags];
}

export default function Photos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [inspType, setInspType] = useState<Inspection["type"] | undefined>();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Photo | null>(null);
  // null | "retag" | "analyze" | "delete" — drives the modal busy state.
  const [busy, setBusy] = useState<null | "retag" | "analyze" | "delete">(null);

  const load = useCallback(async () => {
    try {
      const [list, insp] = await Promise.all([
        api.listPhotos(id!),
        api.getInspection(id!).catch(() => null),
      ]);
      list.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
      setPhotos(list);
      if (insp) setInspType(insp.type);
    } catch (e: any) {
      Alert.alert("Failed to load photos", e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload on focus so newly captured photos appear when returning here.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Replace a photo in local state (and the open editor, if it's the one). */
  const applyUpdate = (p: Photo) => {
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    setEditing((cur) => (cur && cur.id === p.id ? p : cur));
  };

  /** Correct the section, then re-run AI for the new tag (best effort). */
  const retag = async (newTag: string) => {
    if (!editing || newTag === editing.tag || busy) return;
    setBusy("retag");
    try {
      const updated = await api.setPhotoTag(editing.id, newTag);
      applyUpdate(updated);
      try {
        const analysis = await api.analyzePhoto(updated.id);
        applyUpdate({ ...updated, aiAnalysis: analysis as Photo["aiAnalysis"] });
      } catch {
        // Re-tag succeeded; AI can fail without blocking.
      }
    } catch (e: any) {
      Alert.alert("Re-tag failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  const reanalyze = async () => {
    if (!editing || busy) return;
    setBusy("analyze");
    try {
      const analysis = await api.analyzePhoto(editing.id);
      applyUpdate({ ...editing, aiAnalysis: analysis as Photo["aiAnalysis"] });
    } catch (e: any) {
      Alert.alert("Analysis failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert("Delete photo?", "This removes it from the report permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const target = editing;
          setBusy("delete");
          try {
            await api.deletePhoto(target.id);
            setPhotos((prev) => prev.filter((p) => p.id !== target.id));
            setEditing(null);
          } catch (e: any) {
            Alert.alert("Delete failed", e.message);
          } finally {
            setBusy(null);
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

  const tagOptions = sectionTags(inspType);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Manage photos</Text>
      <Text style={styles.sub}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} attached. Tap a photo to
        view, fix its section, or delete it.
      </Text>

      <Pressable
        style={styles.addBtn}
        onPress={() => router.push(`/inspection/${id}/camera`)}
      >
        <Ionicons name="sparkles" size={18} color={colors.onAccent} />
        <Text style={styles.addBtnText}>Add more photos (AI auto-tag)</Text>
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
              <Pressable key={p.id} style={styles.cell} onPress={() => setEditing(p)}>
                {p.url ? (
                  <Image source={{ uri: p.url }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbMissing]}>
                    <Ionicons name="image-outline" size={28} color={colors.textFaint} />
                  </View>
                )}
                {tag === "auto" && (
                  <View style={styles.autoBadge}>
                    <Text style={styles.autoBadgeText}>?</Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="create-outline" size={14} color="#fff" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      <Modal
        visible={!!editing}
        animationType="slide"
        transparent
        onRequestClose={() => !busy && setEditing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Edit photo</Text>
              <Pressable onPress={() => !busy && setEditing(null)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textDim} />
              </Pressable>
            </View>

            {editing && (
              <ScrollView contentContainerStyle={styles.sheetScroll}>
                {editing.url ? (
                  <Image source={{ uri: editing.url }} style={styles.fullImg} resizeMode="contain" />
                ) : (
                  <View style={[styles.fullImg, styles.thumbMissing]}>
                    <Ionicons name="image-outline" size={48} color={colors.textFaint} />
                  </View>
                )}

                <Text style={styles.fieldLabel}>SECTION</Text>
                <Text style={styles.hint}>
                  Wrong section? Tap the correct one — AI re-reads the photo for it.
                </Text>
                <View style={styles.chips}>
                  {/* Surface "auto" as a read-only current state if unclassified. */}
                  {editing.tag === "auto" && (
                    <View style={[styles.chip, styles.chipCurrent]}>
                      <Text style={styles.chipCurrentText}>Unsorted</Text>
                    </View>
                  )}
                  {tagOptions.map((t) => {
                    const active = t === editing.tag;
                    return (
                      <Pressable
                        key={t}
                        style={[styles.chip, active && styles.chipActive]}
                        disabled={!!busy}
                        onPress={() => retag(t)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {prettyTag(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {busy === "retag" && (
                  <View style={styles.busyRow}>
                    <ActivityIndicator color={colors.accent} size="small" />
                    <Text style={styles.busyText}>Re-tagging & re-reading with AI…</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>AI ANALYSIS</Text>
                <Text style={styles.summary}>
                  {editing.aiAnalysis?.summary?.trim()
                    ? editing.aiAnalysis.summary
                    : "No AI analysis yet for this photo."}
                </Text>
                {editing.aiAnalysis?.findings?.length ? (
                  <Text style={styles.findingCount}>
                    {editing.aiAnalysis.findings.length} field
                    {editing.aiAnalysis.findings.length === 1 ? "" : "s"} extracted
                  </Text>
                ) : null}

                <Pressable
                  style={[styles.secondaryBtn, !!busy && { opacity: 0.5 }]}
                  disabled={!!busy}
                  onPress={reanalyze}
                >
                  {busy === "analyze" ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={16} color={colors.accent} />
                      <Text style={styles.secondaryBtnText}>Re-run AI analysis</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.deleteBtn, !!busy && { opacity: 0.5 }]}
                  disabled={!!busy}
                  onPress={confirmDelete}
                >
                  {busy === "delete" ? (
                    <ActivityIndicator color={colors.danger} size="small" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={styles.deleteBtnText}>Delete photo</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  editBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  autoBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.warn,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  autoBadgeText: { color: "#000", fontFamily: font.bold, fontSize: 13 },

  // Editor modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontFamily: font.bold },
  sheetScroll: { padding: 16, gap: 10, paddingBottom: 32 },
  fullImg: {
    width: "100%",
    height: 240,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginTop: 8,
  },
  hint: { color: colors.textFaint, fontSize: 12, fontFamily: font.regular },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.row,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipCurrent: { backgroundColor: colors.dangerFill, borderColor: colors.warn },
  chipText: { color: colors.textDim, fontSize: 12, fontFamily: font.medium },
  chipTextActive: { color: colors.accent, fontFamily: font.bold },
  chipCurrentText: { color: colors.warn, fontSize: 12, fontFamily: font.bold },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  busyText: { color: colors.textDim, fontSize: 12, fontFamily: font.regular },
  summary: { color: colors.text, fontSize: 13, fontFamily: font.regular, lineHeight: 18 },
  findingCount: { color: colors.accent, fontSize: 12, fontFamily: font.semibold },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    marginTop: 8,
  },
  secondaryBtnText: { color: colors.accent, fontFamily: font.semibold, fontSize: 14 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerFill,
  },
  deleteBtnText: { color: colors.danger, fontFamily: font.semibold, fontSize: 14 },
});

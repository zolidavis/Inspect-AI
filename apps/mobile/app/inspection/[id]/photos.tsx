/**
 * Photo management — view, navigate, re-tag, caption, rotate, re-analyze, and
 * delete the photos attached to an inspection.
 *
 * Reached from the hub's Photos card ("View / edit photos"). Photos are
 * grouped by their section tag. Tapping a photo opens a full-size editor where
 * the inspector can:
 *   • swipe / arrow between photos without closing the editor,
 *   • CORRECT the section (re-tag) when the AI auto-classifier guessed wrong —
 *     the server clears the stale analysis and we re-run AI for the new tag,
 *   • write a CAPTION printed under the photo in the report,
 *   • ROTATE the photo (90° steps) — applied in-app and in the PDF,
 *   • re-run AI analysis,
 *   • delete the photo.
 *
 * Works for both 4-Point and Wind Mitigation — the re-tag picker offers only
 * the sections valid for this inspection's type.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  // Index into the flat `ordered` list (null = editor closed).
  const [editIdx, setEditIdx] = useState<number | null>(null);
  // null | "retag" | "analyze" | "delete" — drives the modal busy state.
  const [busy, setBusy] = useState<null | "retag" | "analyze" | "delete">(null);
  const [caption, setCaption] = useState("");

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

  // Group by tag (newest-first within each group) for the grid, and flatten
  // to a stable `ordered` list the editor navigates through.
  const { groups, ordered } = useMemo(() => {
    const g = new Map<string, Photo[]>();
    for (const p of photos) {
      const arr = g.get(p.tag) ?? [];
      arr.push(p);
      g.set(p.tag, arr);
    }
    const flat: Photo[] = [];
    for (const arr of g.values()) flat.push(...arr);
    return { groups: g, ordered: flat };
  }, [photos]);

  const editing = editIdx != null ? ordered[editIdx] ?? null : null;

  // Sync the caption input whenever the open photo changes.
  useEffect(() => {
    setCaption(editing?.caption ?? "");
  }, [editing?.id]);

  const openPhoto = (p: Photo) => {
    const idx = ordered.findIndex((x) => x.id === p.id);
    if (idx >= 0) setEditIdx(idx);
  };

  const go = (delta: number) => {
    if (editIdx == null || busy) return;
    const next = editIdx + delta;
    if (next >= 0 && next < ordered.length) setEditIdx(next);
  };
  // Keep the latest `go` reachable from the (once-created) PanResponder.
  const goRef = useRef(go);
  goRef.current = go;

  // Horizontal swipe on the image → prev/next.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 50) goRef.current(-1);
        else if (g.dx < -50) goRef.current(1);
      },
    }),
  ).current;

  /** Replace a photo in local state. */
  const applyUpdate = (p: Photo) => {
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? p : x)));
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

  /** Commit the caption (on blur / done). */
  const saveCaption = async () => {
    if (!editing) return;
    const trimmed = caption.trim();
    if (trimmed === (editing.caption ?? "")) return;
    try {
      const updated = await api.setPhotoCaption(editing.id, trimmed);
      applyUpdate(updated);
    } catch (e: any) {
      Alert.alert("Couldn't save caption", e.message);
    }
  };

  /** Rotate 90° clockwise — optimistic, PATCH in background. */
  const rotate = async () => {
    if (!editing || busy) return;
    const next = (((editing.rotation ?? 0) + 90) % 360 + 360) % 360;
    applyUpdate({ ...editing, rotation: next });
    try {
      const updated = await api.setPhotoRotation(editing.id, next);
      applyUpdate(updated);
    } catch {
      // Revert on failure.
      applyUpdate({ ...editing });
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
            // Keep the editor on the same slot (now the next photo), or close.
            setEditIdx((cur) => {
              if (cur == null) return null;
              const remaining = ordered.length - 1;
              if (remaining <= 0) return null;
              return Math.min(cur, remaining - 1);
            });
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

  const tagOptions = sectionTags(inspType);
  const rot = editing ? (((editing.rotation ?? 0) % 360) + 360) % 360 : 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Manage photos</Text>
      <Text style={styles.sub}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} attached. Tap a photo to
        view, caption, rotate, fix its section, or delete it.
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
            {items.map((p) => {
              const r = (((p.rotation ?? 0) % 360) + 360) % 360;
              return (
                <Pressable key={p.id} style={styles.cell} onPress={() => openPhoto(p)}>
                  {p.url ? (
                    <Image
                      source={{ uri: p.url }}
                      style={[styles.thumb, !!r && { transform: [{ rotate: `${r}deg` }] }]}
                    />
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
                  {!!p.caption?.trim() && (
                    <View style={styles.capBadge}>
                      <Ionicons name="chatbubble-ellipses" size={12} color="#fff" />
                    </View>
                  )}
                  <View style={styles.editBadge}>
                    <Ionicons name="create-outline" size={14} color="#fff" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      <Modal
        visible={!!editing}
        animationType="slide"
        transparent
        onRequestClose={() => !busy && setEditIdx(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable
                onPress={() => go(-1)}
                disabled={editIdx === 0 || !!busy}
                hitSlop={10}
                style={editIdx === 0 && { opacity: 0.3 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.accent} />
              </Pressable>
              <Text style={styles.sheetTitle}>
                Photo {editIdx != null ? editIdx + 1 : 0} of {ordered.length}
              </Text>
              <View style={styles.headRight}>
                <Pressable
                  onPress={() => go(1)}
                  disabled={editIdx == null || editIdx >= ordered.length - 1 || !!busy}
                  hitSlop={10}
                  style={
                    (editIdx == null || editIdx >= ordered.length - 1) && { opacity: 0.3 }
                  }
                >
                  <Ionicons name="chevron-forward" size={24} color={colors.accent} />
                </Pressable>
                <Pressable onPress={() => !busy && setEditIdx(null)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={colors.textDim} />
                </Pressable>
              </View>
            </View>

            {editing && (
              <ScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.imageWrap} {...pan.panHandlers}>
                  {editing.url ? (
                    <Image
                      source={{ uri: editing.url }}
                      style={[styles.fullImg, !!rot && { transform: [{ rotate: `${rot}deg` }] }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.fullImg, styles.thumbMissing]}>
                      <Ionicons name="image-outline" size={48} color={colors.textFaint} />
                    </View>
                  )}
                </View>

                {/* Quick actions: rotate */}
                <View style={styles.actionRow}>
                  <Pressable style={styles.iconBtn} onPress={rotate} disabled={!!busy}>
                    <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                    <Text style={styles.iconBtnText}>Rotate 90°</Text>
                  </Pressable>
                  <Text style={styles.swipeHint}>‹ swipe to browse ›</Text>
                </View>

                <Text style={styles.fieldLabel}>CAPTION</Text>
                <TextInput
                  style={styles.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  onBlur={saveCaption}
                  placeholder="Add a caption (printed under the photo)…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={saveCaption}
                />

                <Text style={styles.fieldLabel}>SECTION</Text>
                <Text style={styles.hint}>
                  Wrong section? Tap the correct one — AI re-reads the photo for it.
                </Text>
                <View style={styles.chips}>
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
  capBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 24,
    height: 24,
    borderRadius: 12,
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
  headRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  sheetTitle: { color: colors.text, fontSize: 15, fontFamily: font.bold },
  sheetScroll: { padding: 16, gap: 10, paddingBottom: 32 },
  imageWrap: {
    width: "100%",
    height: 240,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fullImg: { width: "100%", height: "100%" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  iconBtnText: { color: colors.accent, fontFamily: font.semibold, fontSize: 13 },
  swipeHint: { color: colors.textFaint, fontSize: 12, fontFamily: font.regular },
  captionInput: {
    color: colors.text,
    fontSize: 14,
    fontFamily: font.regular,
    backgroundColor: colors.row,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    textAlignVertical: "top",
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

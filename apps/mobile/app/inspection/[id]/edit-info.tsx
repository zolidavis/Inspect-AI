/**
 * Edit property + customer info for an existing inspection.
 *
 * Lets the inspector fix typos in the address, owner name, owner
 * email/phone after the inspection was created. Useful when RentCast
 * returned a slightly different owner name or when the inspector got
 * the contact email wrong on the new-inspection form.
 *
 * Hits PATCH /inspections/:id with only the changed fields. The owner
 * name lives inside the `property` blob (RentCast-shaped), so we send
 * the full property back with the override applied — but only if there
 * was an existing property record to begin with (don't fabricate one
 * just because the inspector typed an owner name override).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Inspection, PhotoRequirements } from "@inspect-ai/shared";
import { PHOTO_REQUIREMENT_LABELS } from "@inspect-ai/shared";
import { api } from "../../../lib/api";
import { colors, font } from "../../../lib/theme";

type PhotoReqKey = keyof PhotoRequirements;
const PHOTO_REQ_KEYS: PhotoReqKey[] = [
  "dwellingEachSide",
  "roofEachSlope",
  "plumbingWaterHeater",
  "electricalServicePanel",
  "electricalBoxWithPanelOff",
  "hazardsOrDeficiencies",
];

export default function EditInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [insp, setInsp] = useState<Inspection | null>(null);

  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [numberOfStories, setNumberOfStories] = useState("");
  const [inspectionDate, setInspectionDate] = useState(""); // YYYY-MM-DD
  const [photoReqs, setPhotoReqs] = useState<PhotoRequirements>({});

  useEffect(() => {
    (async () => {
      try {
        const i = await api.getInspection(id!);
        setInsp(i);
        setLine1(i.address.line1);
        setCity(i.address.city);
        setState(i.address.state);
        setZip(i.address.zip);
        setOwnerName(i.property?.ownerName ?? "");
        setOwnerEmail(i.ownerEmail ?? "");
        setOwnerPhone(i.ownerPhone ?? "");
        setNumberOfStories(
          i.property?.numberOfStories != null ? String(i.property.numberOfStories) : "",
        );
        // Default to the inspection date, falling back to the creation date
        // so the field is never blank for older inspections.
        setInspectionDate((i.inspectedOn ?? i.createdAt ?? "").slice(0, 10));
        setPhotoReqs(i.photoRequirements ?? {});
      } catch (e: any) {
        Alert.alert("Failed to load", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !insp) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const save = async () => {
    if (!line1.trim() || !city.trim() || !zip.trim()) {
      Alert.alert("Address required", "Line 1, City, and ZIP must be filled.");
      return;
    }
    const dateStr = inspectionDate.trim();
    if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD, e.g. 2026-06-17.");
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<Inspection> = {
        address: {
          line1: line1.trim(),
          city: city.trim(),
          state: state.trim() || "FL",
          zip: zip.trim(),
        },
        ownerEmail: ownerEmail.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        photoRequirements: photoReqs,
        ...(dateStr ? { inspectedOn: `${dateStr}T00:00:00.000Z` } : {}),
      };
      const storiesNum = numberOfStories.trim()
        ? Number.parseInt(numberOfStories.trim(), 10)
        : null;
      const storiesValid =
        storiesNum != null && Number.isFinite(storiesNum) && storiesNum > 0;
      // Only patch property.ownerName if we already had a property record
      // (don't fabricate one from a single override field).
      if (insp.property) {
        patch.property = {
          ...insp.property,
          ownerName: ownerName.trim() || null,
          numberOfStories: storiesValid ? storiesNum : null,
        };
      } else if (ownerName.trim() || storiesValid) {
        // Property data wasn't fetched yet, but inspector wants to record
        // a name or stories override — create a minimal mock-source record.
        patch.property = {
          address: patch.address!,
          ownerName: ownerName.trim() || null,
          yearBuilt: null,
          squareFootage: null,
          lotSize: null,
          bedrooms: null,
          bathrooms: null,
          parcelId: null,
          numberOfStories: storiesValid ? storiesNum : null,
          permits: [],
          source: "mock",
        };
      }
      await api.patchInspection(insp.id, patch);
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>Property & customer info</Text>
      <Text style={styles.sub}>
        Edit anything that needs correcting. Saved instantly on tap.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Property address</Text>

        <Text style={styles.label}>Street address</Text>
        <TextInput
          style={styles.input}
          value={line1}
          onChangeText={setLine1}
          placeholder="123 Main St"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Tampa"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>State</Text>
            <TextInput
              style={styles.input}
              value={state}
              onChangeText={setState}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ZIP</Text>
            <TextInput
              style={styles.input}
              value={zip}
              onChangeText={setZip}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { marginTop: 14 }]}># of stories</Text>
            <TextInput
              style={[styles.input, { maxWidth: 120 }]}
              value={numberOfStories}
              onChangeText={(v) => setNumberOfStories(v.replace(/[^0-9]/g, ""))}
              placeholder="1"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Text style={[styles.label, { marginTop: 14 }]}>Inspection date</Text>
            <TextInput
              style={styles.input}
              value={inspectionDate}
              onChangeText={(v) => setInspectionDate(v.replace(/[^0-9-]/g, ""))}
              placeholder="2026-06-17"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          # of stories stamps on the OIR-B1-1802; inspection date stamps on both report PDFs.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer info</Text>

        <Text style={styles.label}>Owner name</Text>
        <TextInput
          style={styles.input}
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder={insp.property?.ownerName ?? "e.g. John Smith"}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
        />
        {insp.property?.source === "rentcast" && (
          <Text style={styles.hint}>
            Overrides the name RentCast returned for this address.
          </Text>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>Owner email</Text>
        <TextInput
          style={styles.input}
          value={ownerEmail}
          onChangeText={setOwnerEmail}
          placeholder="owner@example.com"
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Owner phone</Text>
        <TextInput
          style={styles.input}
          value={ownerPhone}
          onChangeText={setOwnerPhone}
          placeholder="(555) 555-5555"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
        />
      </View>

      {/* ── Minimum Photo Requirements card ─────────────────────────── */}
      <View style={styles.card}>
        <View style={photoStyles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Minimum Photo Requirements</Text>
            <Text style={styles.hint}>
              Confirm each category was shot. Renders on page 1 of the 4-Point form.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              const allChecked = PHOTO_REQ_KEYS.every((k) => photoReqs[k] === true);
              const next: PhotoRequirements = {};
              for (const k of PHOTO_REQ_KEYS) next[k] = !allChecked;
              setPhotoReqs(next);
            }}
            style={photoStyles.checkAllBtn}
          >
            <Text style={photoStyles.checkAllText}>
              {PHOTO_REQ_KEYS.every((k) => photoReqs[k] === true) ? "Clear all" : "Check all"}
            </Text>
          </Pressable>
        </View>
        {PHOTO_REQ_KEYS.map((key) => {
          const checked = photoReqs[key] === true;
          return (
            <Pressable
              key={key}
              style={photoStyles.row}
              onPress={() =>
                setPhotoReqs((prev) => ({ ...prev, [key]: !checked }))
              }
            >
              <View
                style={[
                  photoStyles.box,
                  checked && photoStyles.boxOn,
                ]}
              >
                {checked && <Text style={photoStyles.tick}>✓</Text>}
              </View>
              <Text style={photoStyles.rowLabel}>
                {PHOTO_REQUIREMENT_LABELS[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        disabled={saving}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveBtnText}>Save changes</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 14 },
  center: { alignItems: "center", justifyContent: "center" },
  h1: { color: colors.text, fontSize: 22, fontFamily: font.bold },
  sub: { color: colors.textDim, fontSize: 13, fontFamily: font.regular },
  card: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontFamily: font.semibold,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.row,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    fontFamily: font.regular,
  },
  hint: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 4,
    fontFamily: font.regular,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 14 },
});

const photoStyles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 6,
  },
  checkAllBtn: {
    backgroundColor: colors.row,
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 2,
  },
  checkAllText: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: font.bold,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textDim,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tick: {
    color: colors.onAccent,
    fontFamily: font.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.regular,
  },
});

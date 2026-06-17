/**
 * Homeowner signature capture screen.
 *
 * Inspector hands the phone to the homeowner at the end of the
 * inspection. The homeowner sees the property address, taps a
 * "Sign here" button, draws their signature, and confirms. The
 * signature is PATCHed onto the inspection along with a fresh
 * timestamp. The PDF generator embeds it at the page-6 homeowner
 * signature line.
 */
import { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Inspection } from "@inspect-ai/shared";
import { SignaturePad } from "../../../components/SignaturePad";
import { api } from "../../../lib/api";
import { colors, font } from "../../../lib/theme";

const COLORS = {
  bg: colors.bg,
  card: colors.card,
  bgRow: colors.row,
  text: colors.text,
  textDim: colors.textDim,
  textFaint: colors.textFaint,
  border: colors.border,
  accent: colors.accent,
  danger: colors.danger,
};

export default function SignReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [pendingSig, setPendingSig] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const i = await api.getInspection(id!);
        setInsp(i);
        setPendingSig(i.homeownerSignaturePng ?? "");
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
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  const save = async () => {
    if (!pendingSig) {
      Alert.alert("No signature", "Tap the signature line to sign first.");
      return;
    }
    setSaving(true);
    try {
      await api.patchInspection(insp.id, {
        homeownerSignaturePng: pendingSig,
        homeownerSignedAt: new Date().toISOString(),
      });
      Alert.alert("Saved", "Homeowner signature recorded.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Homeowner sign-off</Text>
      <Text style={styles.sub}>
        Hand the phone to the homeowner. They sign to certify that the
        inspection was performed at:
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Property</Text>
        <Text style={styles.cardValue}>{insp.address.line1}</Text>
        <Text style={styles.cardSub}>
          {insp.address.city}, {insp.address.state} {insp.address.zip}
        </Text>
        {insp.property?.ownerName && (
          <>
            <Text style={[styles.cardLabel, { marginTop: 12 }]}>Owner of record</Text>
            <Text style={styles.cardValue}>{insp.property.ownerName}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Homeowner signature</Text>
        {pendingSig ? (
          <View style={styles.sigPreviewWrap}>
            <Image
              source={{ uri: pendingSig }}
              style={styles.sigPreview}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.sigEmpty}>
            <Ionicons name="create-outline" size={26} color={COLORS.textFaint} />
            <Text style={styles.sigEmptyText}>Tap below to sign</Text>
          </View>
        )}
        <Pressable
          style={styles.sigBtn}
          onPress={() => setSigPadOpen(true)}
        >
          <Ionicons name="create-outline" size={16} color={COLORS.accent} />
          <Text style={styles.sigBtnText}>
            {pendingSig ? "Redraw signature" : "Tap to sign"}
          </Text>
        </Pressable>

        <Text style={[styles.cardLabel, { marginTop: 18 }]}>Date</Text>
        <Text style={styles.cardValue}>
          {new Date().toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <Text style={styles.dateHint}>
          Automatically recorded at the moment of signing.
        </Text>
      </View>

      <Text style={styles.legal}>
        By signing, the homeowner certifies that the named Qualified
        Inspector — or their employee — performed an inspection of the
        residence listed above, and that proof of identification was
        provided.
      </Text>

      <Pressable
        style={[
          styles.saveBtn,
          (saving || !pendingSig) && { opacity: 0.5 },
        ]}
        disabled={saving || !pendingSig}
        onPress={save}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.saveBtnText}>Save signature</Text>
        )}
      </Pressable>

      <SignaturePad
        visible={sigPadOpen}
        title="Homeowner signature"
        hint="Have the homeowner draw their signature."
        initialDataUri={pendingSig || undefined}
        onClose={() => setSigPadOpen(false)}
        onSave={(dataUri) => setPendingSig(dataUri)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, gap: 14 },
  center: { alignItems: "center", justifyContent: "center" },
  h1: { color: COLORS.text, fontSize: 22, fontFamily: font.bold },
  sub: { color: COLORS.textDim, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontFamily: font.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: font.semibold,
    marginTop: 4,
  },
  cardSub: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },

  sigPreviewWrap: {
    backgroundColor: "#ffffff", // signature canvas — kept white so the drawn signature is legible
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  sigPreview: { width: "100%", height: "100%" },
  sigEmpty: {
    marginTop: 10,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.bgRow,
  },
  sigEmptyText: { color: COLORS.textFaint, fontSize: 12 },
  sigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  sigBtnText: { color: COLORS.accent, fontFamily: font.bold, fontSize: 13 },
  dateHint: { color: COLORS.textFaint, fontSize: 11, marginTop: 4 },
  legal: {
    color: COLORS.textFaint,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: colors.onAccent, fontFamily: font.extrabold, fontSize: 14 },
});

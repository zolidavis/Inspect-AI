/**
 * Report screen — generate the inspection PDF, save it to a dedicated folder
 * on the device named after the property address, and offer to share it
 * (so the inspector can move it to Downloads / Drive / email).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import type { Inspection } from "@inspect-ai/shared";
import { api } from "../../../lib/api";
import { colors, font } from "../../../lib/theme";

type ReportType = "four_point" | "wind_mitigation" | "both";

const TYPE_LABEL: Record<ReportType, string> = {
  four_point: "4-Point",
  wind_mitigation: "Wind Mitigation",
  both: "Combined",
};

/** Folder under the app's document directory where reports are stored. */
const REPORTS_DIR = `${FileSystem.documentDirectory}Inspect AI Reports/`;

/** Strip characters that aren't safe in a filename. */
function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]+/g, " ") // illegal on most filesystems
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build "110 Bayberry Rd Altamonte Springs FL 32714" from the address. */
function addressBase(insp: Inspection | null): string {
  const a = insp?.address;
  if (!a) return "Inspection Report";
  const parts = [a.line1, a.city, a.state, a.zip].filter(Boolean).join(" ");
  return sanitizeFilename(parts) || "Inspection Report";
}

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [busy, setBusy] = useState<ReportType | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  useEffect(() => {
    api.getInspection(id!).then(setInsp).catch(() => {});
  }, [id]);

  const generate = useCallback(
    async (type: ReportType) => {
      if (busy) return;
      setBusy(type);
      setSavedPath(null);
      try {
        // Ensure the reports folder exists.
        const dir = await FileSystem.getInfoAsync(REPORTS_DIR);
        if (!dir.exists) {
          await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
        }

        const filename = `${addressBase(insp)} (${TYPE_LABEL[type]}).pdf`;
        const fileUri = REPORTS_DIR + filename;

        const { uri, status } = await FileSystem.downloadAsync(
          api.pdfUrl(id!, type),
          fileUri,
        );
        if (status !== 200) throw new Error(`Server returned ${status}`);

        setSavedPath(filename);

        // Offer to share / save elsewhere (Downloads, Drive, email…).
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: filename,
            UTI: "com.adobe.pdf",
          });
        }
      } catch (e: any) {
        Alert.alert("Couldn't generate report", e?.message ?? String(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, id, insp],
  );

  const Btn = ({ type, primary }: { type: ReportType; primary?: boolean }) => (
    <Pressable
      style={[styles.btn, primary && styles.btnPrimary, !!busy && busy !== type && { opacity: 0.5 }]}
      disabled={!!busy}
      onPress={() => generate(type)}
    >
      {busy === type ? (
        <ActivityIndicator color={primary ? colors.onAccent : colors.text} />
      ) : (
        <>
          <Ionicons
            name="download-outline"
            size={18}
            color={primary ? colors.onAccent : colors.text}
          />
          <Text style={[styles.btnText, primary && styles.btnPrimaryText]}>
            Save {TYPE_LABEL[type]} PDF
          </Text>
        </>
      )}
    </Pressable>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Generate report</Text>
      <Text style={styles.p}>
        Saves the PDF to a “Inspect AI Reports” folder on this device, named
        after the property address, then lets you share or move it.
      </Text>

      <Btn type="four_point" />
      <Btn type="wind_mitigation" />
      <Btn type="both" primary />

      {savedPath && (
        <View style={styles.savedCard}>
          <Ionicons name="checkmark-circle" size={18} color={colors.yes} />
          <Text style={styles.savedText}>Saved as {savedPath}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12 },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.text },
  p: { color: colors.textDim, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.row,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { color: colors.text, fontFamily: font.semibold, fontSize: 16 },
  btnPrimaryText: { color: colors.onAccent },
  savedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  savedText: { color: colors.text, fontSize: 13, fontFamily: font.medium, flex: 1 },
});

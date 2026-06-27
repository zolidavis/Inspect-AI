/**
 * Report screen — generate the inspection PDF, then:
 *   • save it to a dedicated folder on the device named after the property
 *     address (and share / move it), or
 *   • email it straight to the client using the email on file, via the
 *     device's native mail composer (the inspector sends from their account).
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
import * as MailComposer from "expo-mail-composer";
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
  // Tracks which button is busy: a ReportType (save) or "email".
  const [busy, setBusy] = useState<ReportType | "email" | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  useEffect(() => {
    api.getInspection(id!).then(setInsp).catch(() => {});
  }, [id]);

  const clientEmail = insp?.ownerEmail?.trim() || "";

  /** Download a report PDF into the reports folder; returns its file URI + name. */
  const downloadReport = useCallback(
    async (type: ReportType): Promise<{ uri: string; filename: string }> => {
      const dir = await FileSystem.getInfoAsync(REPORTS_DIR);
      if (!dir.exists) {
        await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
      }
      const filename = `${addressBase(insp)} (${TYPE_LABEL[type]}).pdf`;
      const fileUri = REPORTS_DIR + filename;
      const { uri, status } = await FileSystem.downloadAsync(api.pdfUrl(id!, type), fileUri);
      if (status !== 200) throw new Error(`Server returned ${status}`);
      return { uri, filename };
    },
    [id, insp],
  );

  /** Save to device + open the share sheet. */
  const save = useCallback(
    async (type: ReportType) => {
      if (busy) return;
      setBusy(type);
      setSavedPath(null);
      try {
        const { uri, filename } = await downloadReport(type);
        setSavedPath(filename);
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
    [busy, downloadReport],
  );

  /** Email the report to the client using the address on file. */
  const emailToClient = useCallback(async () => {
    if (busy) return;
    if (!(await MailComposer.isAvailableAsync())) {
      Alert.alert(
        "No mail app set up",
        "Add an email account to this device's mail app, then try again. You can also use “Save” and share the PDF to email.",
      );
      return;
    }
    setBusy("email");
    setSavedPath(null);
    try {
      // The inspection's own type is the natural report to send.
      const type = (insp?.type ?? "both") as ReportType;
      const { uri } = await downloadReport(type);
      const addr = insp?.address;
      const where = addr ? `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}` : "";
      await MailComposer.composeAsync({
        recipients: clientEmail ? [clientEmail] : [],
        subject: `Your ${TYPE_LABEL[type]} inspection report${where ? ` — ${addr!.line1}` : ""}`,
        body:
          `Hello,\n\nAttached is the ${TYPE_LABEL[type]} inspection report` +
          `${where ? ` for ${where}` : ""}.\n\n` +
          `Please don't hesitate to reach out with any questions.\n\n` +
          `${insp?.inspectorName ?? ""}${insp?.inspectorCompany ? `\n${insp.inspectorCompany}` : ""}` +
          `${insp?.inspectorPhone ? `\n${insp.inspectorPhone}` : ""}`,
        attachments: [uri],
      });
    } catch (e: any) {
      Alert.alert("Couldn't open email", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }, [busy, clientEmail, downloadReport, insp]);

  const SaveBtn = ({ type, primary }: { type: ReportType; primary?: boolean }) => (
    <Pressable
      style={[styles.btn, primary && styles.btnPrimary, !!busy && busy !== type && { opacity: 0.5 }]}
      disabled={!!busy}
      onPress={() => save(type)}
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

      {/* ── Email to client ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>EMAIL TO CLIENT</Text>
      <Pressable
        style={[styles.emailBtn, !!busy && busy !== "email" && { opacity: 0.5 }]}
        disabled={!!busy}
        onPress={emailToClient}
      >
        {busy === "email" ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Ionicons name="mail-outline" size={18} color={colors.onAccent} />
            <Text style={styles.emailBtnText}>
              {clientEmail ? "Email report to client" : "Email report…"}
            </Text>
          </>
        )}
      </Pressable>
      <Text style={styles.emailHint}>
        {clientEmail
          ? `Opens your mail app to ${clientEmail} with the report attached.`
          : "No client email on file — add one on the Property & customer screen, or the mail app will open with a blank recipient."}
      </Text>

      {/* ── Save to device ──────────────────────────────────────────────── */}
      <Text style={[styles.sectionLabel, { marginTop: 10 }]}>SAVE TO DEVICE</Text>
      <Text style={styles.p}>
        Saves to an “Inspect AI Reports” folder named after the property address,
        then lets you share or move it.
      </Text>
      <SaveBtn type="four_point" />
      <SaveBtn type="wind_mitigation" />
      <SaveBtn type="both" primary />

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
  scroll: { padding: 16, gap: 10 },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.text },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: font.bold,
    letterSpacing: 1,
    marginTop: 4,
  },
  p: { color: colors.textDim, fontSize: 13, fontFamily: font.regular, lineHeight: 19 },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 10,
  },
  emailBtnText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 16 },
  emailHint: { color: colors.textFaint, fontSize: 12, fontFamily: font.regular, lineHeight: 17 },
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
  btnPrimary: { backgroundColor: colors.accentDim, borderColor: colors.accentDim },
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

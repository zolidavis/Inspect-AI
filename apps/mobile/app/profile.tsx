/**
 * Profile screen. Reached from the avatar in the inspection list's
 * header. Shows: avatar + display name + email + provider, edit fields,
 * inspector certification block (the OIR-B1-1802 "Qualified Inspector"
 * section — set once, auto-fills every inspection + PDF), sign out.
 */
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { SignaturePad } from "../components/SignaturePad";
import {
  INSPECTOR_LICENSE_TYPES,
  initialsFor,
  useProfile,
  type InspectorLicenseType,
} from "../store/profile";

/**
 * Blue palette tuned to the app icon (navy backdrop #1c4280).
 *   accent     — primary brand blue, bright on dark background
 *   accentDeep — saved-button text on lighter chips, also the icon
 *                navy when we need it
 */
const COLORS = {
  bg: "#0b1014",
  bgRow: "#161c22",
  bgElevated: "#10161c",
  text: "#f0f4f8",
  textDim: "#8a96a4",
  textFaint: "#54616f",
  border: "#222a32",
  accent: "#3b82f6",         // bright blue (Tailwind blue-500)
  accentDeep: "#1c4280",     // icon backdrop navy
  accentSoft: "#1a2c4a",     // selected-row fill on dark bg
  danger: "#ef5a5a",
};

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile((s) => s.profile);
  const saveProfile = useProfile((s) => s.saveProfile);
  const signOut = useProfile((s) => s.signOut);

  const [name, setName] = useState(profile?.displayName ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [inspectorName, setInspectorName] = useState(profile?.inspectorName ?? "");
  const [inspectorLicense, setInspectorLicense] = useState(profile?.inspectorLicense ?? "");
  const [inspectorLicenseType, setInspectorLicenseType] = useState<InspectorLicenseType | "">(
    profile?.inspectorLicenseType ?? "",
  );
  const [inspectorCompany, setInspectorCompany] = useState(profile?.inspectorCompany ?? "");
  const [inspectorPhone, setInspectorPhone] = useState(profile?.inspectorPhone ?? "");
  const [inspectorSignaturePng, setInspectorSignaturePng] = useState(
    profile?.inspectorSignaturePng ?? "",
  );
  const [businessLogoPng, setBusinessLogoPng] = useState(
    profile?.businessLogoPng ?? "",
  );
  const [pickingLogo, setPickingLogo] = useState(false);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isGoogleAccount = profile?.provider === "google";

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Pick a name.");
      return;
    }
    setSaving(true);
    await saveProfile({
      displayName: name,
      email,
      inspectorName,
      inspectorLicense,
      inspectorLicenseType,
      inspectorCompany,
      inspectorPhone,
      inspectorSignaturePng,
      businessLogoPng,
    });
    setSaving(false);
  };

  /** Pick a logo image and read it as a data URI for cover-page embedding. */
  const pickLogo = async () => {
    if (pickingLogo) return;
    setPickingLogo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert("Couldn't load image", "Try a different image.");
        return;
      }
      const mime = (asset.mimeType ?? "image/png").toLowerCase();
      const dataUri = `data:${mime};base64,${asset.base64}`;
      setBusinessLogoPng(dataUri);
    } catch (e: any) {
      Alert.alert("Image picker failed", e.message);
    } finally {
      setPickingLogo(false);
    }
  };

  const clearLogo = () => {
    Alert.alert("Remove logo?", "The PDF cover page will no longer include it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setBusinessLogoPng("") },
    ]);
  };

  const doSignOut = () => {
    Alert.alert(
      "Sign out?",
      "Your inspections stay on this device but you'll be sent back to the welcome screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/welcome");
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.heroRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(profile)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>{profile?.displayName || "Anonymous"}</Text>
          <Text style={styles.heroSub}>
            {profile?.email || "no email on file"}
          </Text>
          <View style={styles.providerBadge}>
            <Ionicons
              name={
                profile?.provider === "google"
                  ? "logo-google"
                  : profile?.provider === "apple"
                    ? "logo-apple"
                    : "person-outline"
              }
              size={11}
              color={COLORS.textDim}
            />
            <Text style={styles.providerBadgeText}>
              {profile?.provider === "google"
                ? "Google account"
                : profile?.provider === "apple"
                  ? "Apple ID"
                  : "Local profile"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Display name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Email</Text>
        <TextInput
          style={[styles.input, isGoogleAccount && styles.inputDisabled]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!saving && !isGoogleAccount}
        />
        {isGoogleAccount && (
          <Text style={styles.hint}>Managed by your Google account.</Text>
        )}

      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Qualified Inspector</Text>
        <Text style={styles.hint}>
          OIR-B1-1802 certification info. Stamped on every wind-mit + 4-Point
          PDF. Set once, applies forever.
        </Text>

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Licensed name</Text>
        <TextInput
          style={styles.input}
          value={inspectorName}
          onChangeText={setInspectorName}
          placeholder="As it appears on your FL license"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>License or Certificate #</Text>
        <TextInput
          style={styles.input}
          value={inspectorLicense}
          onChangeText={setInspectorLicense}
          placeholder="e.g. HI-12345"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Inspection Company</Text>
        <TextInput
          style={styles.input}
          value={inspectorCompany}
          onChangeText={setInspectorCompany}
          placeholder="Company name"
          placeholderTextColor={COLORS.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Phone</Text>
        <TextInput
          style={styles.input}
          value={inspectorPhone}
          onChangeText={setInspectorPhone}
          placeholder="(555) 555-5555"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="phone-pad"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 18 }]}>
          I hold an active license as a:
        </Text>
        <Text style={styles.hint}>Pick one. Matches the "check one" box on the form.</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {INSPECTOR_LICENSE_TYPES.map((t) => {
            const selected = inspectorLicenseType === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setInspectorLicenseType(selected ? "" : t.value)}
                disabled={saving}
                style={[
                  styles.licenseRow,
                  selected && styles.licenseRowOn,
                ]}
              >
                <View style={[styles.licenseDot, selected && styles.licenseDotOn]}>
                  {selected && <View style={styles.licenseDotInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.licenseLabel, selected && styles.licenseLabelOn]}>
                    {t.label}
                  </Text>
                  <Text style={styles.licenseSub}>{t.sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Business logo</Text>
        <Text style={styles.hint}>
          When set, a cover page is prepended to every PDF report with your
          logo + property address + inspector details.
        </Text>

        {businessLogoPng ? (
          <View style={styles.logoPreviewWrap}>
            <Image
              source={{ uri: businessLogoPng }}
              style={styles.logoPreviewImg}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.logoEmpty}>
            <Ionicons name="image-outline" size={28} color={COLORS.textFaint} />
            <Text style={styles.sigEmptyText}>No logo on file</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={pickLogo}
            disabled={pickingLogo}
            style={[styles.sigEditBtn, { flex: 1 }, pickingLogo && { opacity: 0.5 }]}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={COLORS.accent} />
            <Text style={styles.sigEditBtnText}>
              {businessLogoPng ? "Replace logo" : "Upload logo"}
            </Text>
          </Pressable>
          {businessLogoPng ? (
            <Pressable
              onPress={clearLogo}
              style={[styles.sigEditBtn, { width: 110, borderColor: COLORS.danger }]}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={[styles.sigEditBtnText, { color: COLORS.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Signature</Text>
        <Text style={styles.hint}>
          Draw your signature once. It's stamped on every inspection's "Qualified
          Inspector Signature" line.
        </Text>

        {inspectorSignaturePng ? (
          <View style={styles.sigPreviewWrap}>
            <Image
              source={{ uri: inspectorSignaturePng }}
              style={styles.sigPreviewImg}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.sigEmpty}>
            <Ionicons name="create-outline" size={26} color={COLORS.textFaint} />
            <Text style={styles.sigEmptyText}>No signature on file</Text>
          </View>
        )}

        <Pressable
          onPress={() => setSigPadOpen(true)}
          style={styles.sigEditBtn}
        >
          <Ionicons name="create-outline" size={16} color={COLORS.accent} />
          <Text style={styles.sigEditBtnText}>
            {inspectorSignaturePng ? "Redraw signature" : "Tap to sign"}
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        disabled={saving}
        onPress={save}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>

      <SignaturePad
        visible={sigPadOpen}
        title="Inspector signature"
        hint="Draw your signature in the white area, then tap Save."
        initialDataUri={inspectorSignaturePng || undefined}
        onClose={() => setSigPadOpen(false)}
        onSave={(dataUri) => setInspectorSignaturePng(dataUri)}
      />

      <Pressable onPress={doSignOut} style={styles.signOutBtn}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, gap: 16 },

  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  heroName: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  heroSub: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  providerBadgeText: {
    color: COLORS.textDim,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
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
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
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
  inputDisabled: { opacity: 0.6 },
  hint: { color: COLORS.textFaint, fontSize: 11, marginTop: 4, marginBottom: 0 },

  licenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bgRow,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  licenseRowOn: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  licenseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  licenseDotOn: {
    borderColor: COLORS.accent,
  },
  licenseDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  licenseLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  licenseLabelOn: {
    color: COLORS.accent,
  },
  licenseSub: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2,
  },

  sigPreviewWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  sigPreviewImg: { width: "100%", height: "100%" },
  logoPreviewWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  logoPreviewImg: { width: "100%", height: "100%" },
  logoEmpty: {
    marginTop: 10,
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.bgRow,
  },
  sigEmpty: {
    marginTop: 10,
    height: 110,
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
  sigEditBtn: {
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
  sigEditBtnText: { color: COLORS.accent, fontWeight: "700", fontSize: 13 },

  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { color: COLORS.danger, fontWeight: "700", fontSize: 14 },
});

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
import { colors, font } from "../lib/theme";

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
  const [inspectorEmail, setInspectorEmail] = useState(profile?.inspectorEmail ?? "");
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
      inspectorEmail,
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
              color={colors.textDim}
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
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Email</Text>
        <TextInput
          style={[styles.input, isGoogleAccount && styles.inputDisabled]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textFaint}
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
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>License or Certificate #</Text>
        <TextInput
          style={styles.input}
          value={inspectorLicense}
          onChangeText={setInspectorLicense}
          placeholder="e.g. HI-12345"
          placeholderTextColor={colors.textFaint}
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
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Phone</Text>
        <TextInput
          style={styles.input}
          value={inspectorPhone}
          onChangeText={setInspectorPhone}
          placeholder="(555) 555-5555"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
          editable={!saving}
        />

        <Text style={[styles.cardTitle, { marginTop: 14 }]}>Email</Text>
        <TextInput
          style={styles.input}
          value={inspectorEmail}
          onChangeText={setInspectorEmail}
          placeholder="you@inspectco.com"
          placeholderTextColor={colors.textFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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
            <Ionicons name="image-outline" size={28} color={colors.textFaint} />
            <Text style={styles.sigEmptyText}>No logo on file</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={pickLogo}
            disabled={pickingLogo}
            style={[styles.sigEditBtn, { flex: 1 }, pickingLogo && { opacity: 0.5 }]}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.accent} />
            <Text style={styles.sigEditBtnText}>
              {businessLogoPng ? "Replace logo" : "Upload logo"}
            </Text>
          </Pressable>
          {businessLogoPng ? (
            <Pressable
              onPress={clearLogo}
              style={[styles.sigEditBtn, { width: 110, borderColor: colors.danger }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.sigEditBtnText, { color: colors.danger }]}>Remove</Text>
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
            <Ionicons name="create-outline" size={26} color={colors.textFaint} />
            <Text style={styles.sigEmptyText}>No signature on file</Text>
          </View>
        )}

        <Pressable
          onPress={() => setSigPadOpen(true)}
          style={styles.sigEditBtn}
        >
          <Ionicons name="create-outline" size={16} color={colors.accent} />
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
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },

  heroRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onAccent, fontSize: 24, fontFamily: font.extrabold },
  heroName: { color: colors.text, fontSize: 18, fontFamily: font.bold },
  heroSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  providerBadgeText: {
    color: colors.textDim,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: font.semibold,
  },

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
    marginBottom: 6,
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
  inputDisabled: { opacity: 0.6 },
  hint: { color: colors.textFaint, fontSize: 11, marginTop: 4, marginBottom: 0 },

  licenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.row,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  licenseRowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  licenseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  licenseDotOn: {
    borderColor: colors.accent,
  },
  licenseDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  licenseLabel: {
    color: colors.text,
    fontSize: 14,
    fontFamily: font.semibold,
  },
  licenseLabelOn: {
    color: colors.accent,
  },
  licenseSub: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },

  sigPreviewWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderColor: colors.border,
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
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.row,
  },
  sigEmpty: {
    marginTop: 10,
    height: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.row,
  },
  sigEmptyText: { color: colors.textFaint, fontSize: 12 },
  sigEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  sigEditBtnText: { color: colors.accent, fontFamily: font.bold, fontSize: 13 },

  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveBtnText: { color: colors.onAccent, fontFamily: font.extrabold, fontSize: 14 },

  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { color: colors.danger, fontFamily: font.bold, fontSize: 14 },
});

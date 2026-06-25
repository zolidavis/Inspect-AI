import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FourPoint, WindMit, type Inspection } from "@inspect-ai/shared";
import { api, CompleteError } from "../../lib/api";
import { inspectorNameOf, useProfile } from "../../store/profile";
import { colors, font } from "../../lib/theme";

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useProfile((s) => s.profile);
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [completeErrors, setCompleteErrors] = useState<{
    fourPoint?: string[]; windMit?: string[];
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const i = await api.getInspection(id!);
      setInsp(i);
      try {
        const s = await api.getSuggestions(id!);
        setPendingCount(s.suggestions.length);
      } catch { setPendingCount(0); }
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); setCompleteErrors({}); }, [load]));

  if (loading || !insp) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  const tags = sectionTags(insp.type);
  const fp = (insp.fourPoint ?? {}) as any;
  const wm = (insp.windMit ?? {}) as any;
  const countTrue = (obj: any) =>
    obj ? Object.values(obj).filter((v) => v === true).length : 0;
  const pipeTypeNames = (pt: any): string => {
    const map: Record<string, string> = {
      copper: "Copper", pvcCpvc: "PVC/CPVC", galvanized: "Galvanized",
      castIron: "Cast Iron", polybutylene: "Polybutylene", abs: "ABS", pex: "PEX", other: "Other",
    };
    return Object.entries(pt ?? {})
      .filter(([k, v]) => v === true && map[k])
      .map(([k]) => map[k])
      .join(", ");
  };
  const hvacHazards = countTrue(fp.hvac?.hazards);
  const damageCount = (c: any) =>
    countTrue(c?.damage) || (c?.visibleDamage === true ? 1 : 0);
  const showFp = insp.type === "four_point" || insp.type === "both";
  const showWm = insp.type === "wind_mitigation" || insp.type === "both";

  /**
   * True if the profile has inspector info that this inspection lacks
   * — most often: an old inspection created before the License Type /
   * Company / Phone / Signature fields existed.
   */
  const profileHas = (v: string | undefined) => !!v && v.length > 0;
  const inspMissingFromProfile =
    (profileHas(profile?.inspectorName) && !insp.inspectorName) ||
    (profileHas(profile?.inspectorLicense) && !insp.inspectorLicense) ||
    (profileHas(profile?.inspectorLicenseType) && !insp.inspectorLicenseType) ||
    (profileHas(profile?.inspectorCompany) && !insp.inspectorCompany) ||
    (profileHas(profile?.inspectorPhone) && !insp.inspectorPhone) ||
    (profileHas(profile?.inspectorEmail) && !insp.inspectorEmail) ||
    (profileHas(profile?.inspectorSignaturePng) && !insp.inspectorSignaturePng) ||
    (profileHas(profile?.businessLogoPng) && !insp.businessLogoPng);

  /** PATCH the inspection with any profile-derived inspector fields it lacks. */
  const syncFromProfile = async () => {
    if (!profile) return;
    setSyncing(true);
    try {
      const patch: Partial<Inspection> = {};
      if (!insp.inspectorName) patch.inspectorName = inspectorNameOf(profile);
      if (!insp.inspectorLicense && profile.inspectorLicense) patch.inspectorLicense = profile.inspectorLicense;
      if (!insp.inspectorLicenseType && profile.inspectorLicenseType) {
        patch.inspectorLicenseType = profile.inspectorLicenseType as any;
      }
      if (!insp.inspectorCompany && profile.inspectorCompany) patch.inspectorCompany = profile.inspectorCompany;
      if (!insp.inspectorPhone && profile.inspectorPhone) patch.inspectorPhone = profile.inspectorPhone;
      if (!insp.inspectorEmail && profile.inspectorEmail) patch.inspectorEmail = profile.inspectorEmail;
      if (!insp.inspectorSignaturePng && profile.inspectorSignaturePng) {
        patch.inspectorSignaturePng = profile.inspectorSignaturePng;
      }
      if (!insp.businessLogoPng && profile.businessLogoPng) {
        patch.businessLogoPng = profile.businessLogoPng;
      }
      const updated = await api.patchInspection(insp.id, patch);
      setInsp(updated);
    } catch (e: any) {
      Alert.alert("Sync failed", e.message);
    } finally {
      setSyncing(false);
    }
  };

  const complete = async () => {
    setCompleting(true); setCompleteErrors({});
    try {
      const updated = await api.completeInspection(insp.id);
      setInsp(updated);
      Alert.alert("Marked complete", "Inspection is ready for final report.");
    } catch (e) {
      if (e instanceof CompleteError) {
        const renderIssues = (issues: Array<{ path: string; message: string }> | null | undefined) =>
          issues?.map((i) => `${i.path || "(form)"}: ${i.message}`);
        setCompleteErrors({
          fourPoint: renderIssues(e.payload.fourPoint),
          windMit: renderIssues(e.payload.windMit),
        });
      } else {
        Alert.alert("Failed", (e as Error).message);
      }
    } finally { setCompleting(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{insp.address.line1}</Text>
          <Text style={styles.sub}>
            {insp.address.city}, {insp.address.state} {insp.address.zip}
          </Text>
        </View>
        <View style={[styles.statusBadge, insp.status === "complete" && styles.statusComplete]}>
          <Text style={[styles.statusText, insp.status === "complete" && styles.statusTextComplete]}>
            {insp.status}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Property &amp; customer</Text>
          <Pressable onPress={() => router.push(`/inspection/${insp.id}/edit-info`)}>
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
        <Row k="Inspection date" v={fmt(insp.inspectedOn ? insp.inspectedOn.slice(0, 10) : undefined)} />
        <Row k="Owner" v={insp.property?.ownerName ?? "—"} />
        <Row k="Email" v={fmt(insp.ownerEmail)} />
        <Row k="Phone" v={fmt(insp.ownerPhone)} />
        {insp.property && (
          <>
            <Row k="Year Built" v={insp.property.yearBuilt ? String(insp.property.yearBuilt) : "—"} />
            <Row k="Sq Ft" v={insp.property.squareFootage ? String(insp.property.squareFootage) : "—"} />
            <Row k="# of Stories" v={insp.property.numberOfStories ? String(insp.property.numberOfStories) : "—"} />
            <Row k="Source" v={insp.property.source} />
            {insp.property.permits.length === 0 && (
              <Text style={styles.dim}>Permit lookup is stubbed — county scrapers TBD.</Text>
            )}
          </>
        )}
      </View>

      {pendingCount > 0 && (
        <Link href={`/inspection/${insp.id}/suggestions`} asChild>
          <Pressable style={styles.suggestBanner}>
            <Text style={styles.suggestText}>
              {pendingCount} AI suggestion{pendingCount === 1 ? "" : "s"} to review
            </Text>
            <Text style={styles.suggestArrow}>›</Text>
          </Pressable>
        </Link>
      )}

      {inspMissingFromProfile && (
        <Pressable
          style={[styles.syncBanner, syncing && { opacity: 0.5 }]}
          disabled={syncing}
          onPress={syncFromProfile}
        >
          <Ionicons name="sync-outline" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>Update inspector info</Text>
            <Text style={styles.syncHint}>
              Tap to apply your profile (license type, company, phone, signature)
              to this inspection.
            </Text>
          </View>
          {syncing ? <ActivityIndicator color={colors.accent} /> : (
            <Text style={styles.syncArrow}>›</Text>
          )}
        </Pressable>
      )}

      {showFp && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>4-Point form</Text>
            <Pressable onPress={() => router.push(`/inspection/${insp.id}/edit/four-point`)}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
          <Section title="Electrical">
            <Row
              k="Main panel"
              v={`${fmt(fp.electrical?.mainPanel?.brandModel)} @ ${fmt(fp.electrical?.mainPanel?.totalAmps)}A`}
            />
            <Row
              k="Wiring"
              v={fmt(
                Object.entries(fp.electrical?.wiringTypes ?? {})
                  .filter(([, v]) => v === true)
                  .map(([k]) =>
                    k === "nmBxOrConduit" ? "NM/BX/Conduit"
                    : k === "copperCladAl" ? "Copper Clad AL"
                    : k === "singleStrandAl" ? "Single Strand AL"
                    : k === "multistrandAl" ? "Multistrand AL"
                    : k === "clothKnobAndTube" ? "Cloth (Knob & Tube)"
                    : k === "clothJacketRubberInsulated" ? "Cloth Jacket Rubber"
                    : k.charAt(0).toUpperCase() + k.slice(1)
                  )
                  .join(", ") || undefined,
              )}
            />
            <Row
              k="Hazards"
              v={fmt(
                Object.entries(fp.electrical?.hazards ?? {})
                  .filter(([k, v]) => v === true && k !== "otherExplain")
                  .length || undefined,
              )}
            />
            <Row k="Condition" v={fmt(fp.electrical?.generalCondition)} />
          </Section>
          <Section title="HVAC">
            <Row k="Central AC / heat" v={`${fmt(fp.hvac?.centralAc)} / ${fmt(fp.hvac?.centralHeat)}`} />
            <Row k="Good working order" v={fmt(fp.hvac?.inGoodWorkingOrder)} />
            <Row k="Age (yrs)" v={fmt(fp.hvac?.ageYears)} />
            <Row k="Hazards" v={fmt(hvacHazards || undefined)} />
          </Section>
          <Section title="Plumbing">
            <Row k="Active leak" v={fmt(fp.plumbing?.activeLeak)} />
            <Row k="Pipe types" v={fmt(pipeTypeNames(fp.plumbing?.pipeTypes) || undefined)} />
            <Row k="Water heater age" v={fmt(fp.plumbing?.waterHeaterAgeYears)} />
          </Section>
          <Section title="Roof — Predominant">
            <Row k="Covering" v={fmt(fp.roof?.predominant?.coveringMaterial)} />
            <Row k="Age (yrs)" v={fmt(fp.roof?.predominant?.ageYears)} />
            <Row k="Condition" v={fmt(fp.roof?.predominant?.condition)} />
            <Row k="Damage items" v={fmt(damageCount(fp.roof?.predominant) || undefined)} />
          </Section>
          {fp.roof?.secondary && Object.keys(fp.roof.secondary).length > 0 && (
            <Section title="Roof — Secondary">
              <Row k="Covering" v={fmt(fp.roof?.secondary?.coveringMaterial)} />
              <Row k="Age (yrs)" v={fmt(fp.roof?.secondary?.ageYears)} />
              <Row k="Condition" v={fmt(fp.roof?.secondary?.condition)} />
              <Row k="Damage items" v={fmt(damageCount(fp.roof?.secondary) || undefined)} />
            </Section>
          )}
          {completeErrors.fourPoint && completeErrors.fourPoint.length > 0 && (
            <View style={styles.errorBlock}>
              <Text style={styles.errorTitle}>Missing/invalid:</Text>
              {completeErrors.fourPoint.map((p) => (
                <Text key={p} style={styles.errorItem}>• {p}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {showWm && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Wind mitigation (OIR-B1-1802)</Text>
            <Pressable onPress={() => router.push(`/inspection/${insp.id}/edit/wind-mit`)}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
          <Row k="1. Building code" v={fmt(wm.buildingCode)} />
          <Row k="2. Roof covering" v={fmt(wm.roofCovering?.type)} />
          <Row k="   Meets code" v={fmt(wm.roofCovering?.meetsCode)} />
          <Row k="3. Deck attachment" v={fmt(wm.roofDeckAttachment)} />
          <Row k="6. Roof-to-wall" v={roofToWall(wm.roofToWallAttachment)} />
          <Row k="5. Geometry" v={fmt(wm.roofGeometry)} />
          <Row k="6. SWR" v={fmt(wm.secondaryWaterResistance)} />
          <Row k="7. Opening protection" v={fmt(wm.openingProtection)} />
          {completeErrors.windMit && completeErrors.windMit.length > 0 && (
            <View style={styles.errorBlock}>
              <Text style={styles.errorTitle}>Missing/invalid:</Text>
              {completeErrors.windMit.map((p) => (
                <Text key={p} style={styles.errorItem}>• {p}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photos</Text>

        {/* Primary CTA — AI auto-tag mode. Inspector shoots anything,
            server classifies each photo into the right section. */}
        <Link href={`/inspection/${insp.id}/camera`} asChild>
          <Pressable style={styles.autoBtn}>
            <Text style={styles.autoBtnEmoji}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.autoBtnText}>Add Photos (AI auto-tag)</Text>
              <Text style={styles.autoBtnHint}>
                Just shoot — AI sorts each photo into the right section
              </Text>
            </View>
            <Text style={styles.autoBtnArrow}>›</Text>
          </Pressable>
        </Link>

        {insp.photos.length > 0 && (
          <Link href={`/inspection/${insp.id}/photos`} asChild>
            <Pressable style={styles.manageRow}>
              <Ionicons name="images-outline" size={16} color={colors.accent} />
              <Text style={styles.manageText}>
                View / edit {insp.photos.length} photo{insp.photos.length === 1 ? "" : "s"}
              </Text>
              <Text style={styles.tagCount}>›</Text>
            </Pressable>
          </Link>
        )}

        <Text style={styles.sectionSubLabel}>Or pick a section to shoot manually:</Text>
        {tags.map((tag) => {
          const count = insp.photos.filter((p) => p.tag === tag).length;
          return (
            <Link key={tag} href={`/inspection/${insp.id}/camera?tag=${encodeURIComponent(tag)}`} asChild>
              <Pressable style={styles.tagRow}>
                <Text style={styles.tagName}>{prettyTag(tag)}</Text>
                <Text style={styles.tagCount}>{count} photo{count === 1 ? "" : "s"}  ›</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>

      {/* Signatures card — visible inline status, with shortcut to /sign for the homeowner. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Signatures</Text>
        <View style={styles.sigRow}>
          <Ionicons
            name={insp.inspectorSignaturePng ? "checkmark-circle" : "ellipse-outline"}
            size={20}
            color={insp.inspectorSignaturePng ? colors.yes : colors.textFaint}
          />
          <Text style={styles.sigLabel}>Inspector</Text>
          <Text style={[
            styles.sigStatus,
            insp.inspectorSignaturePng && styles.sigStatusDone,
          ]}>
            {insp.inspectorSignaturePng ? "on file" : "set up in Profile"}
          </Text>
        </View>
        <Link href={`/inspection/${insp.id}/sign`} asChild>
          <Pressable style={styles.sigRow}>
            <Ionicons
              name={insp.homeownerSignaturePng ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={insp.homeownerSignaturePng ? colors.yes : colors.textFaint}
            />
            <Text style={styles.sigLabel}>Homeowner</Text>
            <Text style={[
              styles.sigStatus,
              insp.homeownerSignaturePng && styles.sigStatusDone,
            ]}>
              {insp.homeownerSignaturePng ? "signed" : "Tap to sign  ›"}
            </Text>
          </Pressable>
        </Link>
      </View>

      {insp.status !== "complete" && (
        <Pressable
          style={[styles.completeBtn, completing && { opacity: 0.5 }]}
          disabled={completing}
          onPress={complete}
        >
          {completing
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={styles.completeText}>Mark complete</Text>}
        </Pressable>
      )}

      <Link href={`/inspection/${insp.id}/report`} asChild>
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>Generate report</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

function sectionTags(type: Inspection["type"]): string[] {
  if (type === "four_point") return [...FourPoint.photoTags];
  if (type === "wind_mitigation") return [...WindMit.photoTags];
  return [...FourPoint.photoTags, ...WindMit.photoTags];
}
function prettyTag(t: string) {
  return t.replace(/^wm\./, "").replace(/_/g, " ").replace(/\./g, " · ");
}
function roofToWall(v: unknown): string {
  const map: Record<string, string> = {
    a_toe_nails: "A. Toenails",
    m1: "1. Metal connectors (≥3 nails)",
    m2: "2. Single strap wrap",
    m3: "3. Purpose-made / structural",
    // legacy
    b_clips: "Clips (1)", c_single_wraps: "Single wrap (1)", d_double_wraps: "Double wrap (3)",
  };
  return typeof v === "string" && map[v] ? map[v] : fmt(v);
}
function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  const empty = v === "—";
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={[styles.rowV, empty && styles.rowVEmpty]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 12, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.text },
  sub: { color: colors.textDim, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: colors.row,
  },
  statusComplete: { backgroundColor: colors.yes },
  statusText: { fontSize: 12, color: colors.textDim, textTransform: "uppercase", fontFamily: font.semibold },
  statusTextComplete: { color: colors.onAccent },
  card: {
    backgroundColor: colors.card, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontFamily: font.semibold, color: colors.text },
  editLink: { color: colors.accent, fontFamily: font.semibold },
  sectionTitle: { fontSize: 13, fontFamily: font.semibold, color: colors.textDim, marginTop: 6, marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowK: { color: colors.textDim, flex: 1 },
  rowV: { fontFamily: font.medium, flex: 1, textAlign: "right", color: colors.text },
  rowVEmpty: { color: colors.textFaint, fontFamily: font.regular },
  dim: { color: colors.textDim, marginTop: 6, fontSize: 12 },
  tagRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  tagName: { textTransform: "capitalize", color: colors.text },
  tagCount: { color: colors.textDim },
  manageRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 10, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.accentSoft, borderRadius: 8,
    borderWidth: 1, borderColor: colors.accent,
  },
  manageText: { flex: 1, color: colors.accent, fontFamily: font.semibold, fontSize: 13 },
  syncBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent, borderWidth: 1,
    padding: 12, borderRadius: 10,
  },
  syncTitle: { fontFamily: font.bold, color: colors.text, fontSize: 13 },
  syncHint: { color: colors.textDim, fontSize: 11, marginTop: 1, lineHeight: 14 },
  syncArrow: { fontSize: 22, color: colors.accent },

  sigRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
  },
  sigLabel: { flex: 1, fontFamily: font.semibold, color: colors.text },
  sigStatus: { color: colors.textDim, fontSize: 13 },
  sigStatusDone: { color: colors.yes, fontFamily: font.semibold },

  autoBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10,
    marginTop: 6, marginBottom: 4,
  },
  autoBtnEmoji: { fontSize: 22 },
  autoBtnText: { fontSize: 15, fontFamily: font.bold, color: colors.text },
  autoBtnHint: { fontSize: 11, color: colors.textDim, marginTop: 1 },
  autoBtnArrow: { fontSize: 24, color: colors.accent },
  sectionSubLabel: {
    fontSize: 11, color: colors.textDim, marginTop: 12, marginBottom: 2,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  cta: { backgroundColor: colors.accent, padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  ctaText: { color: colors.onAccent, fontFamily: font.semibold, fontSize: 16 },
  completeBtn: { backgroundColor: colors.yes, padding: 14, borderRadius: 10, alignItems: "center" },
  completeText: { color: colors.onAccent, fontFamily: font.semibold, fontSize: 16 },
  suggestBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1,
    padding: 14, borderRadius: 10,
  },
  suggestText: { fontFamily: font.semibold, color: colors.text },
  suggestArrow: { fontSize: 22, color: colors.accent },
  errorBlock: {
    marginTop: 10, padding: 10, backgroundColor: colors.dangerFill,
    borderRadius: 8, borderWidth: 1, borderColor: colors.danger,
  },
  errorTitle: { color: colors.danger, fontFamily: font.semibold, marginBottom: 4 },
  errorItem: { color: colors.danger, fontSize: 13 },
});

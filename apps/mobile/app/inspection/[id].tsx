import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FourPoint, WindMit, type Inspection } from "@inspect-ai/shared";
import { api, CompleteError } from "../../lib/api";

export default function InspectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [insp, setInsp] = useState<Inspection | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
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
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const tags = sectionTags(insp.type);
  const fp = (insp.fourPoint ?? {}) as any;
  const wm = (insp.windMit ?? {}) as any;
  const showFp = insp.type === "four_point" || insp.type === "both";
  const showWm = insp.type === "wind_mitigation" || insp.type === "both";

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

      {insp.property && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Property</Text>
          <Row k="Owner" v={insp.property.ownerName ?? "—"} />
          <Row k="Year Built" v={insp.property.yearBuilt ? String(insp.property.yearBuilt) : "—"} />
          <Row k="Sq Ft" v={insp.property.squareFootage ? String(insp.property.squareFootage) : "—"} />
          <Row k="Source" v={insp.property.source} />
          {insp.property.permits.length === 0 && (
            <Text style={styles.dim}>Permit lookup is stubbed — county scrapers TBD.</Text>
          )}
        </View>
      )}

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

      {showFp && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>4-Point form</Text>
            <Pressable onPress={() => router.push(`/inspection/${insp.id}/edit/four-point`)}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
          <Section title="Roof">
            <Row k="Covering" v={fmt(fp.roof?.coveringType)} />
            <Row k="Age (yrs)" v={fmt(fp.roof?.ageYears)} />
            <Row k="Condition" v={fmt(fp.roof?.condition)} />
            <Row k="Visible damage" v={fmt(fp.roof?.visibleDamage)} />
          </Section>
          <Section title="Electrical">
            <Row k="Panel" v={`${fmt(fp.electrical?.panelBrand)} @ ${fmt(fp.electrical?.panelAmps)}A`} />
            <Row k="Wiring" v={fmt(fp.electrical?.wiringType)} />
            <Row k="Hazards" v={fmt(fp.electrical?.hazardsPresent)} />
          </Section>
          <Section title="Plumbing">
            <Row k="Supply" v={fmt(fp.plumbing?.supplyMaterial)} />
            <Row k="Water heater age" v={fmt(fp.plumbing?.waterHeaterAgeYears)} />
          </Section>
          <Section title="HVAC">
            <Row k="System" v={fmt(fp.hvac?.systemType)} />
            <Row k="Age (yrs)" v={fmt(fp.hvac?.ageYears)} />
            <Row k="Condition" v={fmt(fp.hvac?.condition)} />
          </Section>
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
          <Row k="4. Roof-to-wall" v={fmt(wm.roofToWallAttachment)} />
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

      {insp.status !== "complete" && (
        <Pressable
          style={[styles.completeBtn, completing && { opacity: 0.5 }]}
          disabled={completing}
          onPress={complete}
        >
          {completing
            ? <ActivityIndicator color="#fff" />
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
  root: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 22, fontWeight: "700" },
  sub: { color: "#666", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "#eee",
  },
  statusComplete: { backgroundColor: "#1f9d3b" },
  statusText: { fontSize: 12, color: "#555", textTransform: "uppercase", fontWeight: "600" },
  statusTextComplete: { color: "#fff" },
  card: {
    backgroundColor: "#fafafa", padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "#eee",
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  editLink: { color: "#0a66ff", fontWeight: "600" },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 6, marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowK: { color: "#666", flex: 1 },
  rowV: { fontWeight: "500", flex: 1, textAlign: "right" },
  rowVEmpty: { color: "#bbb", fontWeight: "400" },
  dim: { color: "#888", marginTop: 6, fontSize: 12 },
  tagRow: {
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#e2e2e2",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  tagName: { textTransform: "capitalize" },
  tagCount: { color: "#888" },
  autoBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#eef9f1",
    borderColor: "#2dd4a3", borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10,
    marginTop: 6, marginBottom: 4,
  },
  autoBtnEmoji: { fontSize: 22 },
  autoBtnText: { fontSize: 15, fontWeight: "700", color: "#0a3d2c" },
  autoBtnHint: { fontSize: 11, color: "#3a6b56", marginTop: 1 },
  autoBtnArrow: { fontSize: 24, color: "#0a3d2c" },
  sectionSubLabel: {
    fontSize: 11, color: "#888", marginTop: 12, marginBottom: 2,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  cta: { backgroundColor: "#0a66ff", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  completeBtn: { backgroundColor: "#1f9d3b", padding: 14, borderRadius: 10, alignItems: "center" },
  completeText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  suggestBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fffaee", borderColor: "#e1b94a", borderWidth: 1,
    padding: 14, borderRadius: 10,
  },
  suggestText: { fontWeight: "600", color: "#7a5a0a" },
  suggestArrow: { fontSize: 22, color: "#7a5a0a" },
  errorBlock: {
    marginTop: 10, padding: 10, backgroundColor: "#fdecec",
    borderRadius: 8, borderWidth: 1, borderColor: "#f0bcbc",
  },
  errorTitle: { color: "#a02020", fontWeight: "600", marginBottom: 4 },
  errorItem: { color: "#a02020", fontSize: 13 },
});

import { useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useRouter } from "expo-router";
import type { InspectionType } from "@inspect-ai/shared";
import { api } from "../lib/api";

const TYPES: { value: InspectionType; label: string }[] = [
  { value: "four_point", label: "4-Point" },
  { value: "wind_mitigation", label: "Wind Mitigation" },
  { value: "both", label: "Both" },
];

export default function NewInspection() {
  const router = useRouter();
  const [type, setType] = useState<InspectionType>("four_point");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!line1 || !city || !zip) {
      Alert.alert("Address required", "Enter line 1, city, and zip.");
      return;
    }
    setBusy(true);
    try {
      const inspection = await api.createInspection({
        type,
        address: { line1, city, state: "FL", zip },
        inspectorName: inspectorName || undefined,
        inspectorLicense: license || undefined,
      });
      // Best-effort address enrichment.
      try {
        const property = await api.lookupAddress(inspection.address);
        await api.patchInspection(inspection.id, { property } as any);
      } catch {}
      router.replace(`/inspection/${inspection.id}`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Inspection type</Text>
      <View style={styles.segmented}>
        {TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.segment, type === t.value && styles.segmentOn]}
            onPress={() => setType(t.value)}
          >
            <Text style={[styles.segmentText, type === t.value && styles.segmentTextOn]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Property address</Text>
      <TextInput style={styles.input} placeholder="Street address" value={line1} onChangeText={setLine1} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          placeholder="City" value={city} onChangeText={setCity}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="ZIP" value={zip} onChangeText={setZip} keyboardType="number-pad"
        />
      </View>

      <Text style={styles.label}>Inspector (optional)</Text>
      <TextInput style={styles.input} placeholder="Name" value={inspectorName} onChangeText={setInspectorName} />
      <TextInput style={styles.input} placeholder="License #" value={license} onChangeText={setLicense} />

      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={create}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 8 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12, color: "#444" },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: "#fff",
  },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: "#0a66ff", borderRadius: 8, overflow: "hidden" },
  segment: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentOn: { backgroundColor: "#0a66ff" },
  segmentText: { color: "#0a66ff", fontWeight: "600" },
  segmentTextOn: { color: "#fff" },
  button: {
    marginTop: 24, backgroundColor: "#0a66ff", borderRadius: 8,
    paddingVertical: 14, alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

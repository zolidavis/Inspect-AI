import {
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import type { FieldMeta } from "../lib/form-meta";

export function getAt(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
export function setAt<T extends object>(obj: T, path: string, value: unknown): T {
  // Deep-clone via JSON. Form data is plain JSON-shaped (strings, numbers,
  // booleans, nested objects) so this is safe and equivalent to
  // structuredClone — which Hermes (RN's JS engine on Android) doesn't
  // ship in our currently-pinned version, causing a runtime ReferenceError
  // the moment FormEditor renders.
  const next: any = obj == null ? {} : JSON.parse(JSON.stringify(obj));
  const parts = path.split(".");
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]!] = value;
  return next;
}

export function FieldEditor({
  field, value, error, onChange,
}: {
  field: FieldMeta;
  value: unknown;
  error?: string;
  onChange: (next: unknown) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{field.label}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {field.kind === "string" && (
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChangeText={(t) => onChange(t === "" ? undefined : t)}
        />
      )}

      {field.kind === "integer" && (
        <TextInput
          style={[styles.input, error && styles.inputError]}
          keyboardType="number-pad"
          value={value == null ? "" : String(value)}
          onChangeText={(t) => {
            if (t === "") return onChange(undefined);
            const n = parseInt(t, 10);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
      )}

      {field.kind === "boolean" && (
        <Switch
          value={value === true}
          onValueChange={(b) => onChange(b)}
        />
      )}

      {field.kind === "enum" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {field.options.map((opt) => {
            const on = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(on ? undefined : opt.value)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  label: { fontSize: 13, color: "#444", fontWeight: "600" },
  error: { fontSize: 12, color: "#c33" },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: "#fff",
  },
  inputError: { borderColor: "#c33" },
  chipsRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: "#bbb", backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: "#0a66ff", borderColor: "#0a66ff" },
  chipText: { color: "#333", fontSize: 13 },
  chipTextOn: { color: "#fff", fontWeight: "600" },
});

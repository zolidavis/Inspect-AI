import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useRouter } from "expo-router";
import { FieldEditor, getAt, setAt } from "./FieldEditor";
import type { SectionMeta } from "../lib/form-meta";
import { isFieldVisible } from "../lib/form-meta";
import { api } from "../lib/api";
import type { Inspection } from "@inspect-ai/shared";

/**
 * Reusable editor. Given a section list and the form key on Inspection
 * (`fourPoint` or `windMit`), renders all fields, supports Save (PATCH),
 * and surfaces server validation errors per field.
 */
export function FormEditor({
  inspectionId, formKey, sections, title,
}: {
  inspectionId: string;
  formKey: "fourPoint" | "windMit";
  sections: SectionMeta[];
  title: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const i = await api.getInspection(inspectionId);
        setState((i as any)[formKey] ?? {});
      } finally { setLoading(false); }
    })();
  }, [inspectionId, formKey]);

  const update = useCallback((path: string, value: unknown) => {
    setState((cur: any) => setAt(cur, path, value));
    setErrors((e) => {
      if (!e[path]) return e;
      const { [path]: _drop, ...rest } = e;
      return rest;
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const patch: Partial<Inspection> = { [formKey]: state } as any;
      await api.patchInspection(inspectionId, patch);
      router.back();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.h1}>{title}</Text>
        {sections.map((section) => {
          // Render only the visible fields; hide a whole card if everything
          // inside is conditional and currently off.
          const visible = section.fields.filter((f) => isFieldVisible(f, state, getAt));
          if (visible.length === 0) return null;
          return (
            <View key={section.title} style={styles.card}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {visible.map((field) => (
                <FieldEditor
                  key={field.path}
                  field={field}
                  value={getAt(state, field.path)}
                  error={errors[field.path]}
                  onChange={(v) => update(field.path, v)}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.save, saving && { opacity: 0.5 }]}
          disabled={saving} onPress={save}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 12, gap: 10, paddingBottom: 100 },
  h1: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  card: {
    backgroundColor: "#fafafa", padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#eee",
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: 12, backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#ccc",
  },
  save: { backgroundColor: "#0a66ff", padding: 14, borderRadius: 8, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

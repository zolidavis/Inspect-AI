import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useRouter } from "expo-router";
import { FieldEditor, getAt, setAt } from "./FieldEditor";
import type { SectionMeta } from "../lib/form-meta";
import { isFieldVisible } from "../lib/form-meta";
import { api } from "../lib/api";
import { colors, font } from "../lib/theme";
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
        let s = (i as any)[formKey] ?? {};
        // Default electrical panel age to the home's age (panels are usually
        // original unless updated). Only pre-fill when the field is empty so
        // a saved value is never clobbered. Second panel only if it's in use.
        if (formKey === "fourPoint") {
          const yb = i.property?.yearBuilt;
          const homeAge = yb ? new Date().getFullYear() - yb : null;
          if (homeAge != null && homeAge >= 0 && homeAge <= 150) {
            const main = s.electrical?.mainPanel ?? {};
            if (main.panelAge == null) {
              s = setAt(s, "electrical.mainPanel.panelAge", homeAge);
            }
            const second = s.electrical?.secondPanel ?? {};
            const secondInUse = Object.keys(second).length > 0;
            if (secondInUse && second.panelAge == null) {
              s = setAt(s, "electrical.secondPanel.panelAge", homeAge);
            }
          }
        }
        setState(s);
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
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
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
          {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  list: { padding: 12, gap: 10, paddingBottom: 100, backgroundColor: colors.bg },
  h1: { fontSize: 20, fontFamily: font.bold, color: colors.text, marginBottom: 4 },
  card: {
    backgroundColor: colors.card, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: 15, fontFamily: font.semibold, color: colors.text, marginBottom: 4 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  save: { backgroundColor: colors.accent, padding: 14, borderRadius: 10, alignItems: "center" },
  saveText: { color: colors.onAccent, fontFamily: font.bold, fontSize: 16 },
});

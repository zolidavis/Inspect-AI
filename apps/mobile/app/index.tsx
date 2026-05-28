import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import type { Inspection } from "@inspect-ai/shared";
import { api } from "../lib/api";

export default function Inspections() {
  const router = useRouter();
  const [items, setItems] = useState<Inspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.listInspections());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <View style={styles.root}>
      {error && <Text style={styles.error}>API unreachable: {error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No inspections yet</Text>
            <Text style={styles.emptyHint}>Tap + to start one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/inspection/${item.id}`} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>
                {item.address.line1}, {item.address.city}
              </Text>
              <Text style={styles.rowMeta}>
                {labelForType(item.type)} · {item.status}
              </Text>
            </Pressable>
          </Link>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push("/new")}>
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </View>
  );
}

function labelForType(t: Inspection["type"]) {
  return t === "four_point" ? "4-Point" : t === "wind_mitigation" ? "Wind Mit" : "4-Point + Wind Mit";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#ddd" },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowMeta: { fontSize: 13, color: "#666", marginTop: 2 },
  empty: { padding: 40, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptyHint: { color: "#666", marginTop: 6 },
  error: { backgroundColor: "#fee", padding: 10, color: "#900" },
  fab: {
    position: "absolute", right: 24, bottom: 32,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0a66ff", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabPlus: { color: "#fff", fontSize: 28, lineHeight: 30, fontWeight: "600" },
});

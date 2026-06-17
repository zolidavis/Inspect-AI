import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../../lib/api";
import { colors, font } from "../../../lib/theme";

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const open = (type: "four_point" | "wind_mitigation" | "both") => {
    Linking.openURL(api.pdfUrl(id!, type));
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Generate report</Text>
      <Text style={styles.p}>Opens a server-generated PDF in your browser.</Text>

      <Pressable style={styles.btn} onPress={() => open("four_point")}>
        <Text style={styles.btnText}>4-Point PDF</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => open("wind_mitigation")}>
        <Text style={styles.btnText}>Wind Mitigation PDF</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnCombined]} onPress={() => open("both")}>
        <Text style={styles.btnCombinedText}>Combined PDF</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { padding: 16, gap: 12, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.text },
  p: { color: colors.textDim },
  btn: { backgroundColor: colors.accent, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { color: colors.onAccent, fontFamily: font.semibold, fontSize: 16 },
  btnCombined: { backgroundColor: colors.row },
  btnCombinedText: { color: colors.text, fontFamily: font.semibold, fontSize: 16 },
});

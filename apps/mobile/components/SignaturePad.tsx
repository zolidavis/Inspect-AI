/**
 * Drawn signature capture.
 *
 * Wraps react-native-signature-canvas (which runs an HTML canvas inside
 * a WebView). `onSave` fires with a base64 data URI string like
 * "data:image/png;base64,iVBORw0KGgo…" once the user finalizes.
 *
 * Usage:
 *   <SignaturePad
 *     visible={open}
 *     onClose={() => setOpen(false)}
 *     onSave={(dataUri) => { saveProfile({ inspectorSignaturePng: dataUri }); }}
 *   />
 */
import { useRef } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Signature, { type SignatureViewRef } from "react-native-signature-canvas";

interface Props {
  visible: boolean;
  title?: string;
  hint?: string;
  /** Existing signature shown when the pad opens, if any. */
  initialDataUri?: string;
  onClose: () => void;
  onSave: (dataUri: string) => void;
}

export function SignaturePad({
  visible,
  title = "Sign here",
  hint = "Use your finger to sign, then tap Save.",
  initialDataUri,
  onClose,
  onSave,
}: Props) {
  const ref = useRef<SignatureViewRef>(null);

  // CSS for the inner WebView. White background + black ink. The
  // ".m-signature-pad--footer" rule hides the default footer because we
  // render our own toolbar buttons outside the canvas.
  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body, html { background: #fff; }
  `;

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.headerLink}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable
            onPress={() => ref.current?.readSignature()}
            hitSlop={12}
          >
            <Text style={[styles.headerLink, { fontWeight: "700" }]}>Save</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{hint}</Text>

        <View style={styles.pad}>
          <Signature
            ref={ref}
            onOK={(dataUri) => {
              onSave(dataUri);
              onClose();
            }}
            onEmpty={() => {
              // User tapped Save without drawing anything — just close.
              onClose();
            }}
            descriptionText=""
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#000000"
            minWidth={1.5}
            maxWidth={3.5}
            imageType="image/png"
            // Show prior signature as starting point if we have one
            dataURL={initialDataUri || undefined}
            // Disable auto-clear when the canvas mounts
            autoClear={false}
            trimWhitespace
          />
        </View>

        <View style={styles.toolbar}>
          <Pressable
            onPress={() => ref.current?.clearSignature()}
            style={styles.toolBtn}
          >
            <Text style={styles.toolBtnText}>Clear</Text>
          </Pressable>
          <View style={styles.toolHint}>
            <Text style={styles.toolHintText}>
              Draw on the white area above
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b1014",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#10161c",
    borderBottomWidth: 1,
    borderBottomColor: "#222a32",
  },
  headerTitle: {
    color: "#f0f4f8",
    fontSize: 16,
    fontWeight: "700",
  },
  headerLink: {
    color: "#2dd4a3",
    fontSize: 15,
  },
  hint: {
    color: "#8a96a4",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  pad: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  toolBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#222a32",
    borderRadius: 8,
  },
  toolBtnText: {
    color: "#f0f4f8",
    fontWeight: "600",
  },
  toolHint: { flex: 1, alignItems: "flex-end", paddingRight: 6 },
  toolHintText: { color: "#8a96a4", fontSize: 11 },
});

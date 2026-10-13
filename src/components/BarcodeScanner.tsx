import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef } from "react";
import { Linking, Pressable, StyleSheet, Text, Vibration, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";

// Full-screen camera that reads one product barcode, then calls onScanned.
export function BarcodeScanner({
  onScanned,
  onCancel,
}: {
  onScanned: (code: string) => void;
  onCancel: () => void;
}) {
  // The camera needs permission. `permission` is null while the phone is checking.
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same barcode many times a second; only act on the first.
  const handled = useRef(false);

  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={40} color={colors.primary} />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>
          PantryGo uses the camera only to read barcodes. Nothing is recorded or uploaded.
        </Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow camera" onPress={requestPermission} />
        ) : (
          // Said "no" before: the phone won't ask again, so send them to Settings
          <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} />
        )}
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancelText}>Type it in instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        // Food barcodes: EAN-13 (most products), EAN-8 (small packs), UPC (American products)
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          handled.current = true;
          Vibration.vibrate(40); // a little buzz: "got it"
          onScanned(data);
        }}
      />

      {/* On top of the camera: a frame to aim with, and a cancel button */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.instructions}>Point at a barcode</Text>
        <View style={styles.frame} />
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  overlay: {
    position: "absolute", // cover the camera exactly
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  instructions: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  frame: {
    width: 280,
    height: 160,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.white,
  },
  cancelButton: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  permission: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  permissionText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 21,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  cancelText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
});

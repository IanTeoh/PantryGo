import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PressableScale } from "@/components/PressableScale";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { tick } from "@/utils/haptics";

// A sheet from the bottom of the screen listing your households.
// Tap one to switch to it, or join / create another.
export function HouseholdSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { household, households, switchHousehold } = useHousehold();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tapping the dimmed background closes it */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Your households</Text>

        {households.map((h) => {
          const current = h.id === household?.id;
          return (
            <PressableScale
              key={h.id}
              scaleTo={0.98}
              onPress={() => {
                if (!current) tick();
                switchHousehold(h.id);
                onClose();
              }}
              style={[styles.row, current && styles.rowOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
            >
              <Avatar
                name={h.name}
                photo={h.photo}
                bucket="household-photos"
                shape="rounded"
                size={40}
                background={current ? colors.primary : colors.card}
                color={current ? colors.onPrimary : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{h.name}</Text>
                <Text style={styles.meta}>
                  {h.role === "admin" ? "You're the owner" : "Member"}
                </Text>
              </View>
              {current && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              {/* Its people and owner */}
              <Pressable
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/household/[id]", params: { id: h.id } });
                }}
                hitSlop={10}
                style={styles.peopleButton}
                accessibilityLabel={`Members of ${h.name}`}
              >
                <Ionicons name="people-outline" size={20} color={colors.textSoft} />
              </Pressable>
            </PressableScale>
          );
        })}

        <Pressable
          onPress={() => {
            onClose();
            router.push("/household-add");
          }}
          style={styles.addRow}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.addText}>Join or create another household</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  peopleButton: { padding: 4 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
});

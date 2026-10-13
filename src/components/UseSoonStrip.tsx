import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";
import type { Item } from "@/types";
import { daysUntil } from "@/utils/dates";
import { freshnessColor, getFreshness } from "@/utils/freshness";

// The "Use soon" cards that scroll sideways at the top of the Pantry screen.
export function UseSoonStrip({ items }: { items: Item[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Use soon</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item) => {
          const days = daysUntil(item.expiry!); // `!`: we know every item here has a date
          const when =
            days < 0 ? "Expired" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
          return (
            // Tap a card to open that item
            <Pressable
              key={item.id}
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.dot, { backgroundColor: freshnessColor[getFreshness(item)] }]} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.when}>{when}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    paddingHorizontal: spacing.lg,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  when: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSoft,
  },
});

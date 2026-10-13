import { Stack, router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { ItemRow } from "@/components/ItemRow";
import { PressableScale } from "@/components/PressableScale";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";
import { isSoon, shelfItems, shelfLabel, type ShelfBy, type ShelfKey } from "@/utils/shelves";

// One shelf of the pantry, e.g. /shelf/spices?by=type or /shelf/fridge?by=place.
// Slides in from the Pantry tab; swipe or tap back to return.
export default function ShelfScreen() {
  const params = useLocalSearchParams<{ key: string; by?: string }>();
  const by: ShelfBy = params.by === "place" ? "place" : "type";
  const key = params.key as ShelfKey;
  const { items, changeQuantity, setQuantity, discardItem } = usePantry();

  const onShelf = shelfItems(items, by, key);
  const soonCount = key === "soon" ? 0 : onShelf.filter(isSoon).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: shelfLabel(by, key), headerBackTitle: "Pantry" }} />
      <Animated.ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.summary}>
          {onShelf.length} {onShelf.length === 1 ? "item" : "items"}
          {soonCount > 0 ? ` · ${soonCount} to use soon` : ""}
        </Text>
        {onShelf.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing on this shelf right now.</Text>
            <PressableScale onPress={() => router.push("/add-item")} style={styles.addButton}>
              <Text style={styles.addText}>Add an item</Text>
            </PressableScale>
          </View>
        ) : (
          onShelf.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={rowEntering(index)}
              exiting={rowExiting}
              layout={rowLayout}
            >
              <ItemRow
                item={item}
                onChangeQuantity={changeQuantity}
                onUsedAll={(id) => setQuantity(id, 0)}
                onDiscard={discardItem}
              />
            </Animated.View>
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl * 2 },
  summary: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.textSoft,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  empty: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSoft },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  addText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
});

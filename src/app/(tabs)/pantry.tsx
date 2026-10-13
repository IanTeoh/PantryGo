import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import Animated from "react-native-reanimated";

import { BigHeader } from "@/components/BigHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { FilterChips } from "@/components/FilterChips";
import { ItemRow } from "@/components/ItemRow";
import { PressableScale } from "@/components/PressableScale";
import { sampleItems } from "@/data/sampleItems";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { Location } from "@/types";
import { compareByExpiry, getFreshness } from "@/utils/freshness";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";

// "all" plus the three real locations
type LocationFilter = "all" | Location;

export default function PantryScreen() {
  // ---- Shared data: lives in PantryContext so every tab sees the same items ----
  const { items, loading, refresh, changeQuantity, setQuantity, discardItem, addItem } =
    usePantry();

  // ---- Local state: only this screen cares ----
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // ---- Derived values: worked out from state on every render, never stored ----
  const countIn = (loc: Location) => items.filter((it) => it.location === loc).length;
  const filters: { value: LocationFilter; label: string; dot?: string }[] = [
    { value: "all", label: `All · ${items.length}` },
    { value: "fridge", label: `Fridge · ${countIn("fridge")}`, dot: colors.iconFridge },
    { value: "freezer", label: `Freezer · ${countIn("freezer")}`, dot: colors.iconFreezer },
    { value: "pantry", label: `Pantry · ${countIn("pantry")}`, dot: colors.iconPantry },
  ];

  const visible = items
    .filter((it) => filter === "all" || it.location === filter)
    // Search: keep items whose name contains what's typed (ignoring capitals)
    .filter((it) => it.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort(compareByExpiry);

  // Two sections: things to use soon (in stock, and urgent or soon), then the rest
  const isSoon = (it: (typeof items)[number]) =>
    it.quantity > 0 && ["urgent", "soon"].includes(getFreshness(it));
  const sections = [
    { title: "Use soon", data: visible.filter(isSoon) },
    { title: "Everything else", data: visible.filter((it) => !isSoon(it)) },
  ].filter((s) => s.data.length > 0); // hide empty sections

  // Pull down on the list to fetch the latest from the database
  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // For trying the app out: put the example items into your (empty) pantry
  function addExamples() {
    sampleItems.forEach(({ id, ...rest }) => addItem(rest));
  }

  return (
    <View style={styles.container}>
      {/* A plain scroll view (not a SectionList) so rows can glide when others come and go */}
      <Animated.ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <BigHeader title="Pantry" />
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textSoft} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${items.length} items`}
              placeholderTextColor={colors.textSoft}
              style={styles.searchInput}
              autoCorrect={false}
              clearButtonMode="while-editing" // iPhone: an ✕ to clear it
            />
          </View>
          <FilterChips options={filters} selected={filter} onSelect={setFilter} />
        </View>

        {sections.length === 0 ? (
          loading ? (
            <SkeletonRows count={6} />
          ) : items.length === 0 ? (
            // A brand-new household: nothing in it at all
            <EmptyState
              inset
              art={["carrot", "glass-of-milk", "cheese-wedge"]}
              title="Your pantry is empty"
              text="Scan or add what's in your fridge, freezer and cupboards. Everyone in your household will see it."
              action={{ label: "Add an item", onPress: () => router.push("/add-item") }}
              secondary={{ label: "Add some example items", onPress: addExamples }}
            />
          ) : (
            <Text style={styles.empty}>
              {search ? `Nothing matches "${search.trim()}".` : "Nothing here yet."}
            </Text>
          )
        ) : (
          sections.map((section) => (
            <Animated.View key={section.title} layout={rowLayout}>
              <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
              {section.data.map((item, index) => (
                // entering / exiting / layout: how each row arrives, leaves and moves
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
              ))}
            </Animated.View>
          ))
        )}

        {items.length > 0 && (
          <Text style={styles.footerHint}>Swipe an item left to mark it used or binned.</Text>
        )}
      </Animated.ScrollView>

      {/* Floating buttons: scan, and add */}
      <View style={styles.fabs}>
        <PressableScale
          scaleTo={0.9}
          onPress={() => router.push({ pathname: "/add-item", params: { scan: "1" } })}
          style={styles.fabRound}
          accessibilityLabel="Scan a barcode"
        >
          <Ionicons name="barcode-outline" size={24} color={colors.primary} />
        </PressableScale>
        <PressableScale scaleTo={0.92} onPress={() => router.push("/add-item")} style={styles.fab}>
          <Ionicons name="add" size={22} color={colors.onPrimary} />
          <Text style={styles.fabText}>Add</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.16,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 5,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Extra bottom padding so the last row can scroll clear of the floating buttons
  listContent: { paddingBottom: 120 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 46,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textSoft,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  footerHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.md,
  },
  fabs: {
    position: "absolute", // taken out of the normal layout and placed on top
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    gap: 10,
  },
  fabRound: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  fab: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    ...shadow,
  },
  fabText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

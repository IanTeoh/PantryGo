import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Storage } from "expo-sqlite/kv-store";
import { useDeferredValue, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";

import Animated from "react-native-reanimated";

import { BigHeader } from "@/components/BigHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { FoodIcon } from "@/components/FoodIcon";
import { useFoodPictures } from "@/utils/foodPictures";
import { ItemRow } from "@/components/ItemRow";
import { PressableScale } from "@/components/PressableScale";
import { sampleItems } from "@/data/sampleItems";
import { useAuth } from "@/state/AuthContext";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { Item } from "@/types";
import { compareByExpiry } from "@/utils/freshness";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";
import { isSoon, shelvesFor, type ShelfBy, type ShelfKey } from "@/utils/shelves";

// Show the shelves by type (Spices & herbs, Meat…) or by where things are kept.
// Remembered on this phone.
type ViewMode = ShelfBy;
const VIEW_KEY = "pantrygo.pantryView";
function readView(): ViewMode {
  try {
    return Storage.getItemSync(VIEW_KEY) === "place" ? "place" : "type";
  } catch {
    return "type";
  }
}

// How many "use soon" items to show here before "See all"
const SOON_PREVIEW = 3;

export default function PantryScreen() {
  // ---- Shared data: lives in PantryContext so every tab sees the same items ----
  const {
    items,
    events,
    loading,
    refresh,
    changeQuantity,
    setQuantity,
    discardItem,
    addItem,
    removeItem,
    undoEvent,
  } = usePantry();
  const { session } = useAuth();

  // ---- Local state: only this screen cares ----
  const [view, setView] = useState<ViewMode>(readView);
  const showPictures = useFoodPictures();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // The shelves follow a moment after a tap (useDeferredValue), so the switch
  // responds instantly while the list is rebuilt behind it
  const listView = useDeferredValue(view);

  function chooseView(next: ViewMode) {
    setView(next);
    try {
      Storage.setItemSync(VIEW_KEY, next);
    } catch {
      // not remembered this time: fine
    }
  }

  // ---- Derived values: worked out on every render, never stored ----
  const q = search.trim().toLowerCase();
  const searching = q !== "";
  const results = searching
    ? items.filter((it) => it.name.toLowerCase().includes(q)).sort(compareByExpiry)
    : [];
  const soon = items.filter(isSoon).sort(compareByExpiry);
  const shelves = shelvesFor(items, listView);

  function openShelf(key: ShelfKey) {
    router.push({ pathname: "/shelf/[key]", params: { key, by: listView } });
  }

  // Pull down on the list to fetch the latest from the database
  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // For trying the app out: put the example items into your (empty) pantry.
  // A banner then offers to take them out again.
  const [examples, setExamples] = useState<"none" | "added" | "undoing">("none");
  function addExamples() {
    sampleItems.forEach(({ id, ...rest }) => addItem(rest));
    setExamples("added");
  }

  // Undo: once they've all saved (no temporary ids left), undo each one's "added"
  // entry, which deletes it without leaving "removed" entries in the activity log.
  function undoExamples() {
    setExamples("undoing");
    refresh(); // fetch the saved items and their "added" entries
  }
  useEffect(() => {
    if (examples !== "undoing") return;
    const names = new Set(sampleItems.map((s) => s.name));
    const added = items.filter((it) => names.has(it.name));
    if (added.some((it) => it.id.startsWith("temp-"))) return; // still saving: wait
    setExamples("none");
    (async () => {
      const entries = events.filter(
        (e) =>
          e.type === "added" &&
          e.userId === session?.user.id &&
          added.some((it) => it.id === e.itemId),
      );
      for (const e of entries) {
        if (await undoEvent(e.id)) break; // undo isn't available: fall back below
      }
      // Anything still there (e.g. undo isn't set up yet): just remove it
      const left = added.filter((it) => !entries.some((e) => e.itemId === it.id));
      left.forEach((it) => removeItem(it.id));
    })();
  }, [examples, items, events, session, undoEvent, removeItem]);

  const row = (item: Item, index: number) => (
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
  );

  return (
    <View style={styles.container}>
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
        </View>

        {/* Just added the examples: offer to take them back out */}
        {examples !== "none" && items.length > 0 && (
          <View style={styles.examplesBar}>
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={styles.examplesText}>
              {examples === "undoing"
                ? "Removing the examples…"
                : "Example items added to try things out."}
            </Text>
            {examples === "added" && (
              <>
                <Pressable onPress={undoExamples} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.examplesUndo}>Undo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setExamples("none")}
                  hitSlop={8}
                  accessibilityLabel="Keep them"
                >
                  <Ionicons name="close" size={18} color={colors.textSoft} />
                </Pressable>
              </>
            )}
          </View>
        )}

        {loading && items.length === 0 ? (
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
        ) : searching ? (
          // ---- Searching: every match, from every shelf ----
          results.length === 0 ? (
            <Text style={styles.empty}>Nothing matches "{search.trim()}".</Text>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>
                {results.length} {results.length === 1 ? "MATCH" : "MATCHES"}
              </Text>
              {results.map(row)}
            </View>
          )
        ) : (
          <>
            {/* ---- Use soon: the few that need using first ---- */}
            {soon.length > 0 && (
              <View>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>USE SOON · {soon.length}</Text>
                  {soon.length > SOON_PREVIEW && (
                    <Pressable onPress={() => openShelf("soon")} hitSlop={8}>
                      <Text style={styles.seeAll}>See all</Text>
                    </Pressable>
                  )}
                </View>
                {soon.slice(0, SOON_PREVIEW).map(row)}
              </View>
            )}

            {/* ---- The shelves: tap one to open it ---- */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>SHELVES</Text>
              <View style={styles.segment}>
                {(
                  [
                    ["type", "Type"],
                    ["place", "Location"],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => chooseView(value)}
                    style={[styles.segmentItem, view === value && styles.segmentOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: view === value }}
                  >
                    <Text style={[styles.segmentText, view === value && styles.segmentTextOn]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.shelfCard}>
              {shelves.map((shelf, i) => (
                <Pressable
                  key={shelf.key}
                  onPress={() => openShelf(shelf.key)}
                  style={({ pressed }) => [
                    styles.shelfRow,
                    i > 0 && styles.divider,
                    pressed && { backgroundColor: colors.card },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${shelf.label}, ${shelf.items.length} items`}
                >
                  {/* A peek at what's on the shelf */}
                  {showPictures && (
                    <View style={styles.peek}>
                      {shelf.items.slice(0, 3).map((it, n) => (
                        <View key={it.id} style={[styles.peekIcon, n > 0 && { marginLeft: -12 }]}>
                          <FoodIcon
                            name={it.name}
                            container={it.container}
                            location={it.location}
                            size={34}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shelfName}>{shelf.label}</Text>
                    <Text style={styles.shelfMeta}>
                      {shelf.items.length} {shelf.items.length === 1 ? "item" : "items"}
                      {shelf.soon > 0 ? (
                        <Text style={styles.shelfSoon}> · {shelf.soon} to use soon</Text>
                      ) : null}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
                </Pressable>
              ))}
            </View>
          </>
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
  examplesBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  examplesText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  examplesUndo: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: spacing.lg, // the title brings its own left padding and margins
  },
  seeAll: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },
  shelfCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  shelfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  peek: { flexDirection: "row", width: 34 + 2 * 22 },
  peekIcon: { borderRadius: 13, borderWidth: 2, borderColor: colors.surface },
  shelfName: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  shelfMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 1 },
  shelfSoon: { color: colors.soon, fontFamily: fonts.bodySemi },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSoft },
  segmentTextOn: { color: colors.primary },
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

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";
import Animated, { FadeIn } from "react-native-reanimated";

import { FoodIcon } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import { COMMON_FOODS } from "@/data/commonFoods";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePantry } from "@/state/PantryContext";
import { pantryMatch, useShopping, type ShoppingItem } from "@/state/ShoppingContext";
import { BigHeader } from "@/components/BigHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonRows } from "@/components/Skeleton";
import { colors, fonts, radius, spacing } from "@/theme";
import type { Item } from "@/types";
import { groupByAisle } from "@/utils/aisles";
import { tick } from "@/utils/haptics";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";
import { guessLocation, isLow, sameName } from "@/utils/stock";
import { formatAmount } from "@/utils/units";

export default function ShoppingScreen() {
  const { list, loading, refresh, addToList, toggleDone, removeFromList, clearDone } =
    useShopping();
  const { items } = usePantry();

  const [name, setName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // ---- Derived ----
  const toBuy = list.filter((r) => !r.done);
  const inTrolley = list.filter((r) => r.done);
  const onList = (n: string) => list.some((r) => sameName(r.name, n));

  // Running low in the pantry, and not on the list yet
  const lowItems = items.filter((it) => isLow(it) && !list.some((r) => pantryMatch(r, [it])));

  // While typing: things that start with (or contain) what's typed. Your pantry first
  // (so it links up), then common foods. Not things already on the list.
  const q = name.trim().toLowerCase();
  const typingSuggestions =
    q.length < 2
      ? []
      : [
          ...items.map((it) => ({ label: it.name, item: it as Item | null })),
          ...COMMON_FOODS.map((f) => ({ label: f.name.replace(/\s*\(.*\)$/, ""), item: null })),
        ]
          .filter((s) => s.label.toLowerCase().includes(q) && !onList(s.label))
          .filter((s, i, all) => all.findIndex((o) => sameName(o.label, s.label)) === i) // no repeats
          .sort(
            (a, b) =>
              Number(b.label.toLowerCase().startsWith(q)) -
              Number(a.label.toLowerCase().startsWith(q)),
          )
          .slice(0, 5);

  function add(text = name, item: Item | null = null) {
    const clean = text.trim();
    if (!clean) return;
    tick();
    // If it matches something in the pantry, link them, so put-away tops that item up
    const match = item ?? items.find((it) => sameName(it.name, clean));
    addToList({ name: clean, itemId: match?.id ?? null });
    setName("");
  }

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const aisles = groupByAisle(toBuy, (r) => r.name);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, inTrolley.length > 0 && { paddingBottom: 130 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The same big title as the other tabs (the content's padding is undone around it) */}
        <View style={styles.bigHeader}>
          <BigHeader
            eyebrow={toBuy.length > 0 ? `${toBuy.length} to buy` : "All done"}
            title="Shopping"
          />
        </View>

        {/* ---- Add: just a name ---- */}
        <View style={styles.addRow}>
          <Ionicons name="add" size={22} color={colors.textSoft} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Add to the list…"
            placeholderTextColor={colors.textSoft}
            style={styles.addInput}
            onSubmitEditing={() => add()}
            returnKeyType="done"
            submitBehavior="submit" // keep the keyboard open, ready for the next thing
            autoCapitalize="sentences"
          />
          {name.trim() !== "" && (
            <Pressable onPress={() => add()} hitSlop={8} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* Suggestions while typing */}
        {typingSuggestions.length > 0 && (
          <View style={styles.chips}>
            {typingSuggestions.map((s) => (
              <PressableScale
                key={s.label}
                scaleTo={0.94}
                onPress={() => add(s.label, s.item)}
                style={styles.chip}
              >
                <Ionicons name={s.item ? "home-outline" : "add"} size={14} color={colors.primary} />
                <Text style={styles.chipText}>{s.label}</Text>
              </PressableScale>
            ))}
          </View>
        )}

        {/* ---- Running low ---- */}
        {q === "" && lowItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>RUNNING LOW</Text>
            <View style={styles.chips}>
              {lowItems.map((it) => (
                <PressableScale
                  key={it.id}
                  scaleTo={0.94}
                  onPress={() => add(it.name, it)}
                  style={styles.chip}
                >
                  <FoodIcon
                    name={it.name}
                    container={it.container}
                    location={it.location}
                    size={22}
                  />
                  <Text style={styles.chipText}>{it.name}</Text>
                  <Ionicons name="add" size={14} color={colors.primary} />
                </PressableScale>
              ))}
            </View>
          </View>
        )}

        {/* ---- To buy, by aisle ---- */}
        {loading ? (
          <SkeletonRows count={5} inset={false} />
        ) : toBuy.length === 0 ? (
          <EmptyState
            art={
              inTrolley.length > 0
                ? ["shopping-bags"]
                : ["red-apple", "shopping-bags", "baguette-bread"]
            }
            title={inTrolley.length > 0 ? "Everything's in the trolley" : "Nothing to buy"}
            text={
              inTrolley.length > 0
                ? "Put it away when you're home and it goes straight into the pantry."
                : "Add things above, tap something that's running low, or add a recipe's missing ingredients."
            }
          />
        ) : (
          aisles.map((aisle) => (
            <Animated.View key={aisle.key} layout={rowLayout} style={styles.section}>
              <Text style={styles.label}>
                {aisle.label.toUpperCase()} · {aisle.rows.length}
              </Text>
              <View style={styles.card}>
                {aisle.rows.map((r, i) => (
                  // Ticked rows fade out of here and into "In the trolley"
                  <Animated.View
                    key={r.id}
                    entering={rowEntering(i)}
                    exiting={rowExiting}
                    layout={rowLayout}
                  >
                    <ShoppingRow
                      row={r}
                      first={i === 0}
                      onToggle={toggleDone}
                      onRemove={removeFromList}
                    />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ))
        )}

        {/* ---- In the trolley ---- */}
        {inTrolley.length > 0 && (
          <Animated.View layout={rowLayout} style={styles.section}>
            <View style={styles.trolleyHeader}>
              <Text style={styles.label}>IN THE TROLLEY · {inTrolley.length}</Text>
              <Pressable onPress={clearDone} hitSlop={8}>
                <Text style={styles.clear}>Remove all</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {inTrolley.map((r, i) => (
                <Animated.View
                  key={r.id}
                  entering={rowEntering(0)}
                  exiting={rowExiting}
                  layout={rowLayout}
                >
                  <ShoppingRow
                    row={r}
                    first={i === 0}
                    onToggle={toggleDone}
                    onRemove={removeFromList}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ---- Put away: opens the check-in screen ---- */}
      {inTrolley.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.bottomBar}>
          <PressableScale
            scaleTo={0.97}
            onPress={() => router.push("/put-away")}
            style={styles.putAway}
          >
            <Ionicons name="basket" size={20} color={colors.onPrimary} />
            <Text style={styles.putAwayText}>
              Put away {inTrolley.length} {inTrolley.length === 1 ? "thing" : "things"}
            </Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

// One line of the list. Only used on this screen, so it lives in this file.
function ShoppingRow({
  row,
  first,
  onToggle,
  onRemove,
}: {
  row: ShoppingItem;
  first: boolean;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const { items } = usePantry();

  const linked = pantryMatch(row, items);
  const who =
    row.addedBy === null || row.addedBy === session?.user.id
      ? null // don't say "added by you" on your own items
      : members.find((m) => m.userId === row.addedBy)?.name;
  const details = [
    linked ? `${formatAmount(linked.quantity, linked.unit)} left at home` : null,
    who ? `added by ${who}` : null,
  ]
    .filter(Boolean) // drop the nulls
    .join(" · ");

  return (
    <View style={[styles.row, !first && styles.divider]}>
      <Pressable
        onPress={() => {
          tick();
          onToggle(row.id);
        }}
        hitSlop={8}
        style={styles.rowMain}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: row.done }}
      >
        {/* The tick fades in */}
        <Animated.View
          key={String(row.done)}
          entering={row.done ? FadeIn.duration(200) : undefined}
        >
          <Ionicons
            name={row.done ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={row.done ? colors.fresh : colors.border}
          />
        </Animated.View>
        <FoodIcon
          name={row.name}
          container={linked?.container ?? "box"}
          location={linked?.location ?? guessLocation(row.name)}
          size={36}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowName, row.done && styles.rowNameDone]}>{row.name}</Text>
          {details !== "" && <Text style={styles.rowDetails}>{details}</Text>}
        </View>
      </Pressable>
      <Pressable
        onPress={() => onRemove(row.id)}
        hitSlop={10}
        accessibilityLabel={`Remove ${row.name}`}
      >
        <Ionicons name="close" size={20} color={colors.textSoft} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  bigHeader: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    height: 52,
  },
  addInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text, padding: 0 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: "center",
  },
  addButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  section: { gap: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: colors.textSoft },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: -spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  rowNameDone: { color: colors.textSoft, textDecorationLine: "line-through" },
  rowDetails: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  trolleyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clear: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSoft },
  bottomBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  putAway: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  putAwayText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

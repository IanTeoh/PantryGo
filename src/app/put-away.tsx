import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";

import { ExpiryPicker } from "@/components/ExpiryPicker";
import { FilterChips } from "@/components/FilterChips";
import { SplitPicker } from "@/components/SplitPicker";
import { FoodIcon } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import { LOCATION_OPTIONS, UNIT_OPTIONS } from "@/data/formOptions";
import { useBudget } from "@/state/BudgetContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePantry } from "@/state/PantryContext";
import {
  pantryMatch,
  useShopping,
  type PutAwayEntry,
  type ShoppingItem,
} from "@/state/ShoppingContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { Item, Location } from "@/types";
import { aisleFor } from "@/utils/aisles";
import { bestFoodMatch } from "@/utils/foodMatch";
import { success, tick } from "@/utils/haptics";
import { guessLocation } from "@/utils/stock";
import { formatAmount } from "@/utils/units";

// "Put away": opened from the shopping list once things are in the trolley.
// For each one, confirm how much you bought (and where it goes, and its use-by date),
// then everything goes into the pantry in one tap.

type Draft = {
  include: boolean; // untick to leave it in the trolley for now
  amountText: string;
  unit: string;
  location: Location;
  expiry: string | null;
};

// Sensible starting values, so most things need no typing at all
function startingDraft(row: ShoppingItem, existing: Item | undefined): Draft {
  if (existing) {
    // Topping up: one more of your usual size, in the same unit
    return {
      include: true,
      amountText: String(existing.capacity),
      unit: existing.unit,
      location: existing.location,
      expiry: null,
    };
  }
  // New to the pantry: guess from the common foods list
  const food = bestFoodMatch(row.name, "pantry");
  const counted = food?.each !== undefined;
  const unit = !food ? "pcs" : counted ? "pcs" : food.basis === "ml" ? "L" : "g";
  const amount = unit === "pcs" ? 1 : unit === "L" ? 1 : 500;
  return {
    include: true,
    amountText: String(amount),
    unit,
    location: aisleFor(row.name) === "frozen" ? "freezer" : guessLocation(row.name),
    expiry: null,
  };
}

export default function PutAwayScreen() {
  const { list, putAway } = useShopping();
  const { items } = usePantry();
  const { addPurchase } = useBudget();
  const { household, members } = useHousehold();
  const spendingOn = household?.spendingEnabled !== false;

  const trolley = list.filter((r) => r.done);

  // One draft per row, keyed by the row's id. Made once, when the screen opens.
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(trolley.map((r) => [r.id, startingDraft(r, pantryMatch(r, items))])),
  );
  const [receiptText, setReceiptText] = useState("");
  // Who the receipt is split between: everyone to start with
  const [splitWith, setSplitWith] = useState<string[]>(() => members.map((m) => m.userId));

  // Change one field of one row's draft (the rest stay as they are)
  function change(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const amountOf = (d: Draft) => Number(d.amountText.replace(",", "."));
  const chosen = trolley.filter((r) => drafts[r.id]?.include);
  const allValid = chosen.every((r) => amountOf(drafts[r.id]) > 0);
  const canSave = chosen.length > 0 && allValid;

  function save() {
    if (!canSave) return;
    success();
    const entries: PutAwayEntry[] = chosen.map((r) => {
      const d = drafts[r.id];
      return {
        rowId: r.id,
        amount: amountOf(d),
        unit: d.unit,
        location: d.location,
        expiry: d.expiry,
      };
    });
    // The receipt total, if given, is recorded as spending (paid by you)
    const total = Number(receiptText.replace(",", ".").replace("$", ""));
    if (spendingOn && Number.isFinite(total) && total > 0) {
      addPurchase({
        description: `Groceries (${entries.length} ${entries.length === 1 ? "item" : "items"})`,
        amount: total,
        splitWith,
        source: "receipt",
      });
    }
    putAway(entries);
    router.back();
  }

  if (trolley.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Nothing in the trolley.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.intro}>Check the amounts, then put it all away.</Text>

        {trolley.map((row) => {
          const d = drafts[row.id];
          if (!d) return null;
          const existing = pantryMatch(row, items);
          const bad = d.include && !(amountOf(d) > 0);
          return (
            <View key={row.id} style={[styles.card, !d.include && styles.cardOff]}>
              {/* ---- What it is ---- */}
              <View style={styles.cardHeader}>
                <FoodIcon
                  name={row.name}
                  container={existing?.container ?? "box"}
                  location={d.location}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.muted}>
                    {existing
                      ? `Tops up your ${existing.name} · ${formatAmount(existing.quantity, existing.unit)} left`
                      : "New to the pantry"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    tick();
                    change(row.id, { include: !d.include });
                  }}
                  hitSlop={10}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: d.include }}
                  accessibilityLabel={`Put away ${row.name}`}
                >
                  <Ionicons
                    name={d.include ? "checkbox" : "square-outline"}
                    size={26}
                    color={d.include ? colors.primary : colors.textSoft}
                  />
                </Pressable>
              </View>

              {d.include && (
                <>
                  {/* ---- How much ---- */}
                  <View style={styles.amountRow}>
                    <Text style={styles.fieldLabel}>How much?</Text>
                    <TextInput
                      value={d.amountText}
                      onChangeText={(t) => change(row.id, { amountText: t })}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      style={[styles.amountInput, bad && styles.inputError]}
                    />
                    {/* Topping up keeps the item's own unit, so the amounts add up */}
                    {existing && <Text style={styles.unitFixed}>{existing.unit}</Text>}
                  </View>
                  {!existing && (
                    <FilterChips
                      options={UNIT_OPTIONS}
                      selected={d.unit}
                      onSelect={(u) => change(row.id, { unit: u })}
                    />
                  )}

                  {/* ---- Where (new things only) ---- */}
                  {!existing && (
                    <FilterChips
                      options={LOCATION_OPTIONS}
                      selected={d.location}
                      onSelect={(loc) => change(row.id, { location: loc })}
                    />
                  )}

                  {/* ---- Use by (optional) ---- */}
                  <ExpiryPicker value={d.expiry} onChange={(e) => change(row.id, { expiry: e })} />
                </>
              )}
            </View>
          );
        })}

        {/* ---- What it cost (optional, if the household uses spending) ---- */}
        {spendingOn && (
          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.fieldLabel}>Receipt total (optional)</Text>
              <TextInput
                value={receiptText}
                onChangeText={setReceiptText}
                placeholder="$0.00"
                placeholderTextColor={colors.textSoft}
                keyboardType="decimal-pad"
                style={styles.receiptInput}
              />
            </View>
            <View style={styles.chipsBleed}>
              <SplitPicker
                selected={splitWith}
                onChange={setSplitWith}
                amount={Number(receiptText.replace(",", ".").replace("$", "")) || undefined}
              />
            </View>
            <Text style={styles.muted}>Recorded as paid by you, on the Spending page.</Text>
          </View>
        )}
      </ScrollView>

      {/* ---- Save ---- */}
      <View style={styles.bottomBar}>
        <PressableScale
          scaleTo={0.97}
          onPress={save}
          disabled={!canSave}
          style={[styles.saveButton, !canSave && { opacity: 0.4 }]}
        >
          <Ionicons name="basket" size={20} color={colors.onPrimary} />
          <Text style={styles.saveText}>
            Put {chosen.length} {chosen.length === 1 ? "thing" : "things"} away
          </Text>
        </PressableScale>
        {!allValid && <Text style={styles.error}>Enter an amount above 0 for each one.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 140 },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  muted: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSoft },

  // Cards bleed the chips to their edges, so the inner padding is per part
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    marginHorizontal: -spacing.lg + spacing.sm,
    paddingHorizontal: 0,
  },
  cardOff: { opacity: 0.6 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  fieldLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  amountInput: {
    width: 90,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.urgent },
  unitFixed: { width: 40, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },

  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  receiptInput: {
    width: 110,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  chipsBleed: { marginHorizontal: -spacing.lg, gap: spacing.sm },
  splitLabel: { paddingHorizontal: spacing.lg },

  bottomBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    gap: spacing.xs,
  },
  saveButton: {
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
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent, textAlign: "center" },
});

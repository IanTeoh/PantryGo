import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import type { ComponentProps } from "react";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityList } from "@/components/ActivityList";
import { ContainerGauge } from "@/components/ContainerGauge";
import { LevelBar } from "@/components/LevelBar";
import { CountableDots } from "@/components/CountableDots";
import { FoodIcon } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import { StatusPill } from "@/components/StatusPill";
import { useNutrition } from "@/state/NutritionContext";
import { usePreferences } from "@/state/PreferencesContext";
import { usePantry } from "@/state/PantryContext";
import { useShopping } from "@/state/ShoppingContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { formatDate } from "@/utils/dates";
import { success, tap, tick, warning } from "@/utils/haptics";
import { estimateForItem } from "@/utils/foodMatch";
import { formatKcal, nutritionFor } from "@/utils/nutrition";
import { readItemView } from "@/utils/itemView";
import { dragStepFor, formatAmount, quickSteps, roundAmount, snapTo } from "@/utils/units";

// The file is called [id].tsx, so /item/8 opens this screen with id = "8".
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, events, setQuantity, discardItem, removeItem } = usePantry();
  const { list, addToList } = useShopping();

  const insets = useSafeAreaInsets();

  // While dragging, the amount the finger is pointing at. null = not dragging.
  const [draft, setDraft] = useState<number | null>(null);
  // A new amount you've picked but not saved yet (drag, quick pour, dots…).
  // null = no unsaved change. Nothing goes to the database until you tap Save.
  const [pending, setPending] = useState<number | null>(null);
  // Also log the used amount as something you ate? (Only offered when calories are known.)
  const [ateIt, setAteIt] = useState(false);
  const { logFood } = useNutrition();
  const { prefs } = usePreferences(); // "I ate this" only if you track calories
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Simple level bar, or the container drawing (Profile → Appearance)
  const [view] = useState(readItemView);
  // The last snapped amount while dragging, so each new step gives one tick
  const lastStep = useRef<number | null>(null);

  const item = items.find((it) => it.id === id);

  // Every hook is called above this line. Hooks can't come after an early return,
  // because React matches them by call order (the rule from Lesson 1).
  if (!item) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "" }} />
        <Text style={styles.missingText}>This item isn't in your pantry any more.</Text>
      </View>
    );
  }

  // ---- Derived values ----
  // What to show: the finger's position while dragging, else the unsaved amount, else the saved one
  const amount = draft ?? pending ?? item.quantity;
  const fraction = item.capacity > 0 ? Math.min(1, amount / item.capacity) : 0;
  const isCountable = item.container === "countable";
  const history = events.filter((e) => e.itemId === item.id);
  const onList = list.some((r) => !r.done && r.itemId === item.id);
  const isOut = item.quantity === 0;
  // If the unsaved change uses some up: what that amount adds up to. Uses the item's
  // own nutrition, or else an estimate from the common foods list.
  const estimate = item.nutrition ? null : estimateForItem(item.name, item.unit);
  const nutritionToUse = item.nutrition ?? estimate?.nutrition ?? null;
  const eaten =
    pending !== null && pending < item.quantity && nutritionToUse
      ? nutritionFor(nutritionToUse, item.quantity - pending, item.unit)
      : null;

  // Gauge fraction → an amount, snapped to a tidy number (e.g. every 10 ml)
  function amountAt(f: number) {
    // `item!`: TypeScript can't tell this runs after the check above, so we promise it
    return snapTo(f * item!.capacity, dragStepFor(item!.unit));
  }

  function onDrag(f: number) {
    const next = amountAt(f);
    if (next !== lastStep.current) {
      tick(); // a light tick for every 10 ml (or step) the level moves
      lastStep.current = next;
    }
    setDraft(next);
  }

  // Pick a new amount without saving it. Picking the saved amount again = no change.
  function choose(n: number) {
    const next = roundAmount(Math.max(0, n));
    setPending(next === item!.quantity ? null : next);
  }

  function confirm() {
    if (pending === null) return;
    success();
    setQuantity(item!.id, pending); // the only place the level is saved
    if (ateIt && eaten) {
      logFood({
        name: item!.name,
        amount: item!.quantity - pending,
        unit: item!.unit,
        ...eaten, // kcal, protein, carbs, fat
        itemId: item!.id,
      });
    }
    setPending(null);
    setAteIt(false);
  }

  function cancel() {
    tap();
    setPending(null); // back to the saved amount
    setAteIt(false);
  }

  function deleteItem() {
    if (!confirmingDelete) {
      setConfirmingDelete(true); // first tap: ask to confirm
      return;
    }
    warning();
    router.back(); // second tap: leave the screen, then remove it
    removeItem(item!.id);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          pending !== null && { paddingBottom: eaten ? 190 : 140 },
        ]}
        scrollEnabled={draft === null} // don't scroll the page while dragging the gauge
      >
        {/* Header: no title (the name is big on the page), and an Edit button */}
        <Stack.Screen
          options={{
            title: "",
            headerRight: () => (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/edit-item/[id]", params: { id: item.id } })
                }
                hitSlop={10}
                style={styles.editButton}
                accessibilityLabel="Edit item"
              >
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ),
          }}
        />

        {/* ---- Name ---- */}
        <View style={styles.titleRow}>
          <FoodIcon
            name={item.name}
            container={item.container}
            location={item.location}
            size={56}
          />
          <View style={styles.titleTexts}>
            <Text style={styles.title}>{item.name}</Text>
            <View style={styles.chips}>
              <Text style={styles.chip}>{item.location}</Text>
              {item.expiry !== null && <StatusPill item={item} />}
              {item.expiry !== null && (
                <Text style={styles.chipPlain}>Use by {formatDate(item.expiry)}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ---- How much is left ---- */}
        <View
          style={[styles.gaugeCard, (isCountable || view === "simple") && styles.gaugeCardColumn]}
        >
          {isCountable ? (
            <>
              <View style={styles.amountBlock}>
                <Text style={styles.bigAmount}>
                  {formatAmount(amount, "").trim()}
                  <Text style={styles.bigUnit}> {item.unit}</Text>
                </Text>
                <Text style={styles.subtle}>
                  of {item.capacity} · tap a circle to set how many are left
                </Text>
              </View>
              <CountableDots
                count={amount}
                capacity={item.capacity}
                onSet={(n) => {
                  tap();
                  choose(n);
                }}
              />
            </>
          ) : view === "simple" ? (
            // Simple view: the amount, and a bar you drag
            <>
              <View style={styles.amountBlock}>
                <Text style={styles.bigAmount}>
                  {formatAmount(amount, "").trim()}
                  <Text style={styles.bigUnit}> {item.unit}</Text>
                </Text>
                <Text style={styles.subtle}>
                  of {formatAmount(item.capacity, item.unit)} · {Math.round(fraction * 100)}% left
                </Text>
              </View>
              <LevelBar
                fraction={fraction}
                color={fraction <= 0.15 ? colors.fillLow : colors.fill}
                onDrag={onDrag}
                onDragEnd={(f) => {
                  lastStep.current = null;
                  setDraft(null);
                  choose(amountAt(f)); // not saved yet: the Save bar appears
                }}
              />
            </>
          ) : (
            <>
              <ContainerGauge
                shape={item.container === "countable" ? "box" : item.container}
                fraction={fraction}
                width={140}
                color={fraction <= 0.15 ? colors.fillLow : colors.fill}
                onDrag={onDrag}
                onDragEnd={(f) => {
                  lastStep.current = null;
                  setDraft(null);
                  choose(amountAt(f)); // not saved yet: the Save bar appears
                }}
              />
              <View style={styles.amountBlock}>
                <Text style={styles.bigAmount}>
                  {formatAmount(amount, "").trim()}
                  <Text style={styles.bigUnit}> {item.unit}</Text>
                </Text>
                <Text style={styles.subtle}>
                  of {formatAmount(item.capacity, item.unit)} · {Math.round(fraction * 100)}% left
                </Text>
                <View style={styles.dragHint}>
                  <Ionicons name="swap-vertical" size={16} color={colors.primary} />
                  <Text style={styles.dragHintText}>Drag the level</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ---- Quick pour: everyday amounts for this unit ---- */}
        <View style={styles.section}>
          <Text style={styles.label}>QUICK {isCountable ? "CHANGE" : "POUR"}</Text>
          <View style={styles.quickRow}>
            {quickSteps(item.unit).map((q) => (
              <PressableScale
                key={q.label}
                scaleTo={0.9}
                onPress={() => {
                  tap();
                  choose((pending ?? item.quantity) + q.delta); // adds up until you save
                }}
                style={styles.quick}
              >
                <Text style={styles.quickText}>{q.label}</Text>
              </PressableScale>
            ))}
            <PressableScale
              scaleTo={0.9}
              onPress={() => {
                tap();
                choose(item.capacity);
              }}
              style={styles.quick}
            >
              <Text style={styles.quickText}>Full</Text>
            </PressableScale>
          </View>
        </View>

        {/* ---- Bigger actions ---- */}
        <View style={styles.actions}>
          <ActionTile
            icon={onList ? "checkmark" : "cart-outline"}
            label={onList ? "On the list" : "To list"}
            tone="primary"
            disabled={onList}
            onPress={() => {
              success();
              addToList({ name: item.name, itemId: item.id });
            }}
          />
          <ActionTile
            icon="checkmark-done"
            label="Used it all"
            tone="soft"
            disabled={isOut}
            onPress={() => {
              success();
              setPending(null);
              setQuantity(item.id, 0);
            }}
          />
          <ActionTile
            icon="trash-outline"
            label="Threw out"
            tone="danger"
            disabled={isOut}
            onPress={() => {
              warning();
              setPending(null);
              discardItem(item.id);
            }}
          />
        </View>

        {/* ---- History ---- */}
        <View style={styles.section}>
          <Text style={styles.label}>HISTORY</Text>
          <ActivityList events={history} emptyText="No changes yet." />
        </View>

        <Pressable onPress={deleteItem} style={styles.deleteButton}>
          <Text style={styles.deleteText}>
            {confirmingDelete ? "Tap again to delete this item" : "Delete item"}
          </Text>
        </Pressable>
      </ScrollView>

      {/* ---- Save bar: only while there's an unsaved change ---- */}
      {pending !== null && (
        // Fades in, and out again when saved or cancelled
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={[styles.saveBar, { paddingBottom: spacing.md + insets.bottom }]}
        >
          {/* "I ate this": also logs the calories of what you used */}
          {eaten && prefs.trackCalories && (
            <Pressable
              onPress={() => {
                tap();
                setAteIt((a) => !a);
              }}
              style={[styles.ateRow, ateIt && styles.ateRowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ateIt }}
            >
              <Ionicons
                name={ateIt ? "checkbox" : "square-outline"}
                size={20}
                color={ateIt ? colors.primary : colors.textSoft}
              />
              <Text style={styles.ateText}>I ate this</Text>
              <Text style={styles.ateKcal}>
                {estimate ? "~" : ""}
                {formatKcal(eaten.kcal)} kcal{estimate ? " (estimate)" : ""}
              </Text>
            </Pressable>
          )}
          <View style={styles.saveRow}>
            <View style={styles.saveTexts}>
              <Text style={styles.saveTitle}>
                {formatAmount(item.quantity, item.unit)} → {formatAmount(pending, item.unit)}
              </Text>
              <Text style={styles.saveSub}>
                {pending < item.quantity
                  ? `Used ${formatAmount(item.quantity - pending, item.unit)}`
                  : `Added ${formatAmount(pending - item.quantity, item.unit)}`}
                {" · not saved yet"}
              </Text>
            </View>
            <Pressable
              onPress={cancel}
              style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <PressableScale
              scaleTo={0.92}
              onPress={confirm}
              style={styles.saveButton}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.saveText}>Save</Text>
            </PressableScale>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ---- A big square-ish action button, used only on this screen ----
function ActionTile({
  icon,
  label,
  tone,
  disabled = false,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone: "primary" | "soft" | "danger";
  disabled?: boolean;
  onPress: () => void;
}) {
  const look = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    soft: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: colors.urgentBg, fg: colors.urgent },
  }[tone];
  return (
    <PressableScale
      scaleTo={0.94}
      onPress={onPress}
      disabled={disabled}
      style={[styles.tile, { backgroundColor: look.bg }, disabled && { opacity: 0.4 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={look.fg} />
      <Text style={[styles.tileText, { color: look.fg }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg + 2, paddingBottom: spacing.xl * 2 },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  missingText: { fontFamily: fonts.body, fontSize: 15, color: colors.textSoft },
  editButton: { paddingHorizontal: spacing.sm },
  editText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primary },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  titleTexts: { flex: 1, gap: 6 },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  chipPlain: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },

  gaugeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  gaugeCardColumn: { flexDirection: "column", alignItems: "stretch" },
  amountBlock: { flex: 1, gap: 6 },
  bigAmount: { fontFamily: fonts.heading, fontSize: 44, lineHeight: 48, color: colors.text },
  bigUnit: { fontFamily: fonts.heading, fontSize: 22 },
  subtle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  dragHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  dragHintText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },

  section: { gap: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: colors.textSoft },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },

  actions: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    height: 72,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tileText: { fontFamily: fonts.bodyBold, fontSize: 13 },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  ateRowOn: { backgroundColor: colors.primarySoft },
  ateText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  ateKcal: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textSoft },
  saveTexts: { flex: 1, gap: 2 },
  saveTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  saveSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  cancelButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textSoft },
  saveButton: {
    height: 44,
    paddingHorizontal: spacing.lg + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },

  deleteButton: { alignItems: "center", padding: spacing.sm },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.urgent },
});

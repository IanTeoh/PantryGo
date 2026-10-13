import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FoodIcon } from "@/components/FoodIcon";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { supabase } from "@/lib/supabase";
import { toEvent, usePantry, type EventRow, type PantryEvent } from "@/state/PantryContext";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import type { Item } from "@/types";
import { describeEvent } from "@/utils/describeEvent";
import { success, warning } from "@/utils/haptics";
import { timeAgo } from "@/utils/timeAgo";
import { formatAmount, roundAmount } from "@/utils/units";

type IconName = ComponentProps<typeof Ionicons>["name"];

const LOOK: Record<PantryEvent["type"], { icon: IconName; tint: keyof typeof tints }> = {
  used: { icon: "remove-circle", tint: "sky" },
  restocked: { icon: "add-circle", tint: "mint" },
  added: { icon: "bag-add", tint: "mint" },
  wasted: { icon: "trash", tint: "coral" },
  removed: { icon: "close-circle", tint: "plum" },
};

// One entry from Recent activity, e.g. /activity/abc: the details, and Undo.
export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, items, undoEvent } = usePantry();
  const { members } = useHousehold();
  const { session } = useAuth();

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Home tab keeps the latest 50 entries. Older ones (opened from "See all")
  // are looked up on their own.
  const fromContext = events.find((e) => e.id === id);
  const [fetched, setFetched] = useState<PantryEvent | null | undefined>(undefined);
  useEffect(() => {
    if (fromContext || !id) return;
    supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setFetched(data ? toEvent(data as EventRow) : null));
  }, [id, fromContext]);
  const event = fromContext ?? fetched ?? undefined;

  if (!event) {
    return (
      <View style={styles.missing}>
        {fetched === undefined && !fromContext ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>This change isn't in the log any more.</Text>
        )}
      </View>
    );
  }

  const item = event.itemId ? items.find((it) => it.id === event.itemId) : undefined;
  const who =
    event.userId === null
      ? "Someone"
      : event.userId === session?.user.id
        ? "You"
        : (members.find((m) => m.userId === event.userId)?.name ?? "Someone");
  const look = LOOK[event.type];
  const when = new Date(event.at).toLocaleString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  const plan = undoPlan(event, item);

  async function undo() {
    if (!confirming) {
      setConfirming(true); // first tap: ask
      return;
    }
    setBusy(true);
    setError(null);
    const message = await undoEvent(event!.id);
    setBusy(false);
    if (message) {
      warning();
      setError(message);
      setConfirming(false);
    } else {
      success();
      router.back();
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* What happened */}
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: tints[look.tint].bg }]}>
          <Ionicons name={look.icon} size={30} color={tints[look.tint].icon} />
        </View>
        <Text style={styles.title}>{describeEvent(event)}</Text>
        <Text style={styles.muted}>
          {who} · {timeAgo(event.at)}
        </Text>
      </View>

      {/* The details */}
      <View style={styles.card}>
        <Row label="When" value={when} />
        <Row label="Who" value={who} divider />
        <Row label="Amount" value={formatAmount(event.amount, event.unit)} divider />
        {event.portion !== null && event.type !== "added" && event.type !== "removed" && (
          <Row label="Of a full pack" value={`about ${Math.round(event.portion * 100)}%`} divider />
        )}
      </View>

      {/* The item, as it is now */}
      {item ? (
        <Pressable
          onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
          style={styles.itemCard}
          accessibilityRole="button"
        >
          <FoodIcon
            name={item.name}
            container={item.container}
            location={item.location}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.muted}>{formatAmount(item.quantity, item.unit)} left now</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </Pressable>
      ) : (
        <Text style={styles.muted}>{event.itemName} isn't in the pantry any more.</Text>
      )}

      {/* Undo */}
      <View style={styles.undoBox}>
        <Text style={styles.undoTitle}>Undo this change</Text>
        <Text style={styles.undoText}>{plan.text}</Text>
        {plan.can && (
          <Pressable
            onPress={undo}
            disabled={busy}
            style={({ pressed }) => [
              styles.undoButton,
              confirming && styles.undoButtonConfirm,
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.undoButtonText, confirming && { color: colors.onPrimary }]}>
                {confirming ? "Tap again to undo" : "Undo"}
              </Text>
            )}
          </Pressable>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </ScrollView>
  );
}

// What undoing would do, in words, and whether it's possible
function undoPlan(e: PantryEvent, item: Item | undefined): { can: boolean; text: string } {
  const amount = formatAmount(e.amount, e.unit);
  if (e.type === "removed") {
    return { can: false, text: "A deleted item can't be brought back. Add it again instead." };
  }
  if (!item) {
    return { can: false, text: "The item has since been deleted, so this can't be undone." };
  }
  switch (e.type) {
    case "used":
    case "wasted": {
      const after = formatAmount(roundAmount(item.quantity + e.amount), item.unit);
      return {
        can: true,
        text: `Puts ${amount} back into ${item.name} (it'll have ${after}) and takes this out of the log${e.type === "wasted" ? " and the waste numbers on Insights" : ""}.`,
      };
    }
    case "restocked": {
      const after = formatAmount(roundAmount(Math.max(item.quantity - e.amount, 0)), item.unit);
      return {
        can: true,
        text: `Takes ${amount} back out of ${item.name} (it'll have ${after}) and removes this from the log.`,
      };
    }
    case "added":
      return {
        can: true,
        text: `Takes ${item.name} out of the pantry, as if it was never added. If you gave it a price, that stays in Spending (remove it there).`,
      };
  }
}

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  hero: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text, textAlign: "center" },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  itemName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  undoBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  undoTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  undoText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  undoButton: {
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.urgent,
  },
  undoButtonConfirm: { backgroundColor: colors.urgent, borderColor: colors.urgent },
  undoButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.urgent },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.urgent },
});

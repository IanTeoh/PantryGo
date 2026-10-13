import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { FilterChips } from "@/components/FilterChips";
import { Gradient } from "@/components/Gradient";
import { MemberChips } from "@/components/MemberChips";
import { PressableScale } from "@/components/PressableScale";
import { SplitPicker } from "@/components/SplitPicker";
import { useAuth } from "@/state/AuthContext";
import { useBudget } from "@/state/BudgetContext";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import {
  balancesWithMe,
  breakdownWith,
  formatMoney,
  myShare,
  splitOf,
  totalSpent,
  type Expense,
  type ExpenseSource,
} from "@/utils/budget";
import { success, tick, warning } from "@/utils/haptics";
import { monthKey } from "@/utils/impact";
import { rowEntering, rowLayout } from "@/utils/motion";

type LogFilter = "all" | "mine" | "others" | "paybacks";

// Where each cost came from, as an icon and a few words
const SOURCES: Record<
  ExpenseSource,
  { icon: ComponentProps<typeof Ionicons>["name"]; label: string; tint: keyof typeof tints }
> = {
  receipt: { icon: "basket-outline", label: "Shopping receipt", tint: "mint" },
  item: { icon: "pricetag-outline", label: "Item price", tint: "honey" },
  manual: { icon: "create-outline", label: "Added here", tint: "sky" },
  settlement: { icon: "swap-horizontal", label: "Paid back", tint: "plum" },
};

// Each housemate gets their own colour (the same one everywhere on this page)
const PERSON_TINTS: (keyof typeof tints)[] = ["mint", "sky", "honey", "plum", "coral"];

// Opened from the Insights tab: what everyone's spent, what's owed between you and
// each person (and why), and every cost in one log.
export default function SpendingScreen() {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const { expenses, refresh, addPurchase, recordSettlement, deleteExpense } = useBudget();
  const me = session?.user.id ?? "";

  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null); // whose breakdown is showing
  const [confirming, setConfirming] = useState<string | null>(null); // two-tap "mark paid"
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<LogFilter>("all");

  // ---- Spending turned off for this household ----
  if (household && !household.spendingEnabled) {
    return (
      <View style={styles.offScreen}>
        <Ionicons name="wallet-outline" size={34} color={colors.textSoft} />
        <Text style={styles.offTitle}>Spending is off</Text>
        <Text style={styles.offText}>
          {household.ownerId === me
            ? "You can turn it on from this household's page."
            : "The household's owner can turn it on from the household's page."}
        </Text>
        <Pressable
          onPress={() =>
            router.replace({ pathname: "/household/[id]", params: { id: household.id } })
          }
          style={styles.offButton}
        >
          <Text style={styles.offButtonText}>Open household page</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Numbers (see utils/budget.ts) ----
  const memberIds = members.map((m) => m.userId);
  const pairs = balancesWithMe(expenses, memberIds, me);
  const owedToMe = pairs.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const iOwe = -pairs.filter((p) => p.amount < 0).reduce((s, p) => s + p.amount, 0);
  const net = owedToMe - iOwe;
  const thisMonth = expenses.filter((e) => monthKey(e.at) === monthKey(Date.now()));
  const monthTotal = totalSpent(thisMonth);
  // What this month cost you: your share of shared costs, plus your personal ones
  const myMonthShare = thisMonth.reduce(
    (s, e) =>
      s +
      (e.kind !== "purchase"
        ? 0
        : e.shared
          ? myShare(e, memberIds, me)
          : e.paidBy === me
            ? e.amount
            : 0),
    0,
  );

  const settled = Math.abs(net) < 0.005;
  const currentMonthLabel = new Date().toLocaleDateString("en-NZ", { month: "long" });
  const toneOf = (id: string | null) =>
    PERSON_TINTS[Math.max(0, memberIds.indexOf(id ?? "")) % PERSON_TINTS.length];

  const nameOf = (id: string | null) =>
    id === me ? "You" : (members.find((m) => m.userId === id)?.name ?? "Someone");
  const firstName = (id: string | null) => nameOf(id).split(" ")[0];

  // The log, filtered, then grouped by month (newest first, as loaded)
  const filtered = expenses.filter((e) =>
    filter === "all"
      ? true
      : filter === "paybacks"
        ? e.kind === "settlement"
        : filter === "mine"
          ? e.kind === "purchase" && e.paidBy === me
          : e.kind === "purchase" && e.paidBy !== me,
  );
  const months: { key: string; label: string; rows: Expense[] }[] = [];
  for (const e of filtered) {
    const key = monthKey(e.at);
    let group = months.find((m) => m.key === key);
    if (!group) {
      group = {
        key,
        label: new Date(e.at).toLocaleDateString("en-NZ", { month: "long", year: "numeric" }),
        rows: [],
      };
      months.push(group);
    }
    group.rows.push(e);
  }

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ---- Your balance ---- */}
      <View style={styles.hero}>
        <Gradient />
        <View style={styles.heroTop}>
          <Text style={styles.heroEyebrow}>YOUR BALANCE</Text>
          <View
            style={[
              styles.heroPill,
              settled ? styles.heroPillSquare : net > 0 ? styles.heroPillOwed : styles.heroPillOwe,
            ]}
          >
            <Ionicons
              name={settled ? "checkmark-circle" : net > 0 ? "arrow-down" : "arrow-up"}
              size={13}
              color={settled ? colors.onHero : net > 0 ? "#0F3D2B" : "#5A1A0C"}
            />
            <Text
              style={[
                styles.heroPillText,
                { color: settled ? colors.onHero : net > 0 ? "#0F3D2B" : "#5A1A0C" },
              ]}
            >
              {settled ? "All square" : net > 0 ? "You're owed" : "You owe"}
            </Text>
          </View>
        </View>
        <Text style={styles.heroNumber}>{settled ? "$0.00" : formatMoney(Math.abs(net))}</Text>
        <Text style={styles.heroCaption}>
          {settled
            ? "Nobody owes anybody anything."
            : "Overall, after everything you've each paid for"}
        </Text>
        {(owedToMe > 0.005 || iOwe > 0.005) && (
          <Text style={styles.heroLine}>
            Owed to you {formatMoney(owedToMe)} · You owe {formatMoney(iOwe)}
          </Text>
        )}
      </View>

      {/* ---- This month: just the totals ---- */}
      <View style={styles.monthCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{currentMonthLabel.toUpperCase()}</Text>
          <Text style={styles.monthTotal}>{formatMoney(monthTotal)}</Text>
          <Text style={styles.muted}>spent by the household</Text>
        </View>
        <View style={styles.shareBox}>
          <Text style={styles.shareValue}>{formatMoney(myMonthShare)}</Text>
          <Text style={styles.muted}>your share</Text>
        </View>
      </View>

      {/* ---- Between you and each person ---- */}
      {members.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.label}>BETWEEN YOU AND…</Text>
          <View style={styles.card}>
            {pairs.map((p, i) => {
              const isOpen = open === p.userId;
              const square = Math.abs(p.amount) < 0.005;
              const theyOwe = p.amount > 0;
              const key = `settle-${p.userId}`;
              const items = isOpen ? breakdownWith(expenses, memberIds, me, p.userId) : [];
              return (
                <Animated.View key={p.userId} layout={rowLayout} style={i > 0 && styles.divider}>
                  <Pressable
                    onPress={() => {
                      tick();
                      setOpen(isOpen ? null : p.userId);
                      setConfirming(null);
                    }}
                    style={styles.personRow}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                  >
                    <View style={[styles.avatar, { backgroundColor: tints[toneOf(p.userId)].bg }]}>
                      <Text style={[styles.avatarText, { color: tints[toneOf(p.userId)].icon }]}>
                        {nameOf(p.userId).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{nameOf(p.userId)}</Text>
                      <Text style={styles.personStatus}>
                        {square ? "All square" : theyOwe ? "Owes you" : "You owe them"}
                      </Text>
                    </View>
                    {!square && (
                      <View style={[styles.amountPill, theyOwe ? styles.pillOwed : styles.pillOwe]}>
                        <Text
                          style={[
                            styles.amountPillText,
                            theyOwe ? styles.owedText : styles.oweText,
                          ]}
                        >
                          {formatMoney(Math.abs(p.amount))}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textSoft}
                    />
                  </Pressable>

                  {/* The breakdown: every cost that adds to (or takes from) this balance */}
                  {isOpen && (
                    <Animated.View
                      entering={FadeIn.duration(200)}
                      exiting={FadeOut.duration(120)}
                      style={styles.breakdown}
                    >
                      {items.length === 0 ? (
                        <Text style={styles.muted}>Nothing shared between you yet.</Text>
                      ) : (
                        items.slice(0, 12).map(({ expense: e, effect }) => (
                          <View key={e.id} style={styles.breakdownRow}>
                            <Text style={styles.breakdownText} numberOfLines={1}>
                              {e.kind === "settlement"
                                ? `${firstName(e.paidBy)} paid ${e.paidTo === me ? "you" : firstName(e.paidTo)} back`
                                : `${e.description} · ${firstName(e.paidBy)} paid ${formatMoney(e.amount)}`}
                            </Text>
                            <Text
                              style={[
                                styles.breakdownAmount,
                                effect > 0 ? styles.owedText : styles.oweText,
                              ]}
                            >
                              {effect > 0 ? "+" : "−"}
                              {formatMoney(Math.abs(effect))}
                            </Text>
                          </View>
                        ))
                      )}
                      {items.length > 12 && (
                        <Text style={styles.muted}>and {items.length - 12} older ones</Text>
                      )}

                      {!square && (
                        <PressableScale
                          scaleTo={0.97}
                          onPress={() => {
                            if (confirming !== key) {
                              setConfirming(key); // first tap: ask
                              return;
                            }
                            success();
                            // Whoever owes pays the other back
                            if (theyOwe) recordSettlement(p.userId, me, p.amount);
                            else recordSettlement(me, p.userId, -p.amount);
                            setConfirming(null);
                          }}
                          style={styles.settleButton}
                        >
                          <Ionicons name="checkmark-done" size={18} color={colors.onPrimary} />
                          <Text style={styles.settleText}>
                            {confirming === key
                              ? "Tap again to confirm"
                              : theyOwe
                                ? `${firstName(p.userId)} paid me ${formatMoney(p.amount)}`
                                : `I paid ${firstName(p.userId)} ${formatMoney(-p.amount)}`}
                          </Text>
                        </PressableScale>
                      )}
                    </Animated.View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
      )}

      {/* ---- Add a cost ---- */}
      {adding ? (
        <AddCost
          me={me}
          showPeople={members.length > 1}
          onDone={() => setAdding(false)}
          onAdd={(p) => {
            success();
            addPurchase({ ...p, source: "manual" });
            setAdding(false);
          }}
        />
      ) : (
        <PressableScale scaleTo={0.97} onPress={() => setAdding(true)} style={styles.addCostButton}>
          <Ionicons name="add-circle" size={20} color={colors.onPrimary} />
          <Text style={styles.addCostText}>Add a cost</Text>
        </PressableScale>
      )}

      {/* ---- The log ---- */}
      <View style={styles.section}>
        <View style={styles.logHeader}>
          <Text style={styles.sectionTitle}>Spending log</Text>
          <Text style={styles.muted}>{formatMoney(monthTotal)} this month</Text>
        </View>
        <View style={styles.bleed}>
          <FilterChips
            options={[
              { value: "all", label: "Everything" },
              { value: "mine", label: "You paid" },
              { value: "others", label: "Others paid" },
              { value: "paybacks", label: "Paybacks" },
            ]}
            selected={filter}
            onSelect={setFilter}
          />
        </View>

        {months.length === 0 ? (
          <Text style={styles.muted}>
            {expenses.length === 0 ? "No costs yet." : "Nothing here with this filter."}
          </Text>
        ) : (
          months.map((m) => (
            <View key={m.key} style={styles.monthBlock}>
              <View style={styles.monthHeader}>
                <Text style={styles.label}>{m.label.toUpperCase()}</Text>
                <Text style={styles.muted}>{formatMoney(totalSpent(m.rows))}</Text>
              </View>
              <View style={styles.card}>
                {m.rows.map((e, i) => (
                  <Animated.View key={e.id} entering={rowEntering(i)} layout={rowLayout}>
                    <LogRow
                      expense={e}
                      first={i === 0}
                      me={me}
                      share={myShare(e, memberIds, me)}
                      splitCount={splitOf(e, memberIds).length}
                      nameOf={nameOf}
                      onDelete={() => {
                        warning();
                        deleteExpense(e.id);
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ---- One cost in the log: where it came from, who paid, who added it ----
function LogRow({
  expense: e,
  first,
  me,
  share,
  splitCount,
  nameOf,
  onDelete,
}: {
  expense: Expense;
  first: boolean;
  me: string;
  share: number; // your share (0 if you're not in the split)
  splitCount: number; // how many people it's split between
  nameOf: (id: string | null) => string;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false); // two-tap delete
  const source = SOURCES[e.source] ?? SOURCES.manual;
  const tint = tints[source.tint];
  const date = new Date(e.at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });

  const title =
    e.kind === "settlement" ? `${nameOf(e.paidBy)} paid ${nameOf(e.paidTo)} back` : e.description;
  const who =
    e.kind === "settlement"
      ? `Recorded by ${nameOf(e.createdBy)}`
      : `${nameOf(e.paidBy)} paid` +
        (e.createdBy && e.createdBy !== e.paidBy ? ` · added by ${nameOf(e.createdBy)}` : "");

  return (
    <View style={[styles.logRow, !first && styles.divider]}>
      <View style={[styles.sourceIcon, { backgroundColor: tint.bg }]}>
        <Ionicons name={source.icon} size={18} color={tint.icon} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.logTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.logMeta} numberOfLines={2}>
          {who} · {date}
        </Text>
        {e.kind === "purchase" && (
          <Text style={styles.logMeta} numberOfLines={1}>
            {source.label}
            {!e.shared
              ? " · personal"
              : share > 0
                ? ` · your share ${formatMoney(share)}`
                : ` · split ${splitCount} ways, not you`}
          </Text>
        )}
      </View>
      <View style={styles.logRight}>
        <Text style={[styles.logAmount, e.kind === "settlement" && { color: tints.plum.icon }]}>
          {formatMoney(e.amount)}
        </Text>
        {e.createdBy === me && (
          <Pressable
            onPress={() => (confirm ? onDelete() : setConfirm(true))}
            hitSlop={10}
            accessibilityLabel="Delete this cost"
          >
            <Text style={[styles.deleteText, confirm && styles.deleteConfirm]}>
              {confirm ? "Delete?" : "Delete"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---- The "add a cost" form (opens from the button) ----
function AddCost({
  me,
  showPeople,
  onAdd,
  onDone,
}: {
  me: string;
  showPeople: boolean;
  onAdd: (p: { description: string; amount: number; paidBy: string; splitWith: string[] }) => void;
  onDone: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidBy, setPaidBy] = useState(me);
  const { members } = useHousehold();
  // Who it's for: everyone, to start with. Untick anyone it isn't for.
  const [splitWith, setSplitWith] = useState<string[]>(() => members.map((m) => m.userId));

  const amount = Number(amountText.replace(",", ".").replace("$", ""));
  const canAdd = description.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.addCard}>
      <View style={styles.addHeader}>
        <Text style={styles.sectionTitle}>Add a cost</Text>
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={styles.muted}>Cancel</Text>
        </Pressable>
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Power bill, toilet paper"
          placeholderTextColor={colors.textSoft}
          style={[styles.input, { flex: 1 }]}
          autoFocus
        />
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="$0.00"
          placeholderTextColor={colors.textSoft}
          keyboardType="decimal-pad"
          style={[styles.input, { width: 96 }]}
        />
      </View>
      {showPeople && (
        <>
          <Text style={styles.fieldLabel}>Who paid?</Text>
          <View style={styles.bleed}>
            <MemberChips selected={paidBy} onSelect={setPaidBy} />
          </View>
        </>
      )}
      {/* Who's it for? Always shown (in a one-person household it explains how to share) */}
      <>
        <View style={[styles.bleed, { marginTop: spacing.xs }]}>
          <SplitPicker
            selected={splitWith}
            onChange={setSplitWith}
            amount={Number.isFinite(amount) ? amount : undefined}
          />
        </View>
      </>
      <PressableScale
        scaleTo={0.97}
        onPress={() =>
          canAdd && onAdd({ description: description.trim(), amount, paidBy, splitWith })
        }
        disabled={!canAdd}
        style={[styles.saveButton, !canAdd && { opacity: 0.4 }]}
      >
        <Text style={styles.saveText}>Add cost</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  muted: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: colors.textSoft },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  bleed: { marginHorizontal: -spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },

  // Hero
  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    padding: spacing.lg + 4,
    gap: 4,
    overflow: "hidden",
  },
  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onHeroSoft,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroPillOwed: { backgroundColor: "#A8E6C1" },
  heroPillOwe: { backgroundColor: "#FFB49E" },
  heroPillSquare: { backgroundColor: "rgba(255,255,255,0.16)" },
  heroPillText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  heroNumber: {
    fontFamily: fonts.heading,
    fontSize: 44,
    lineHeight: 50,
    color: colors.onHero,
    marginTop: spacing.xs,
  },
  heroCaption: { fontFamily: fonts.body, fontSize: 14, color: colors.onHeroSoft },

  // This month
  heroLine: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.onHeroSoft,
    marginTop: spacing.sm,
  },
  monthCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  shareBox: { alignItems: "flex-end" },
  monthTotal: { fontFamily: fonts.heading, fontSize: 26, color: colors.text, marginTop: 2 },
  shareValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },

  // Between you and…
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 17, color: colors.primary },
  personName: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  personStatus: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSoft, marginTop: 1 },
  amountPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillOwed: { backgroundColor: tints.mint.bg },
  pillOwe: { backgroundColor: tints.coral.bg },
  amountPillText: { fontFamily: fonts.bodyBold, fontSize: 14, fontVariant: ["tabular-nums"] },
  owedText: { color: colors.fresh },
  oweText: { color: colors.urgent },
  breakdown: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  breakdownText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  breakdownAmount: { fontFamily: fonts.bodyBold, fontSize: 13, fontVariant: ["tabular-nums"] },
  settleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  settleText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },

  // Add a cost
  addCostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
  },
  addCostText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  addHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addRow: { flexDirection: "row", gap: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },

  // Log
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  monthBlock: { gap: spacing.sm, marginTop: spacing.xs },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  sourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  logMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  logRight: { alignItems: "flex-end", gap: 6 },
  logAmount: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSoft },
  deleteConfirm: { color: colors.urgent },

  // Spending off
  offScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  offTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  offText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  offButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  offButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
});

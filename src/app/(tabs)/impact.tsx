import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { CaloriesCard } from "@/components/CaloriesCard";
import { Gradient } from "@/components/Gradient";
import { MonthlyChart } from "@/components/MonthlyChart";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { useBudget } from "@/state/BudgetContext";
import { useHousehold } from "@/state/HouseholdContext";
import { toEvent, type EventRow, type PantryEvent } from "@/state/PantryContext";
import { useLiveUpdates } from "@/state/useLiveUpdates";
import { BigHeader } from "@/components/BigHeader";
import { SkeletonBlocks } from "@/components/Skeleton";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import { balances, formatMoney, totalSpent } from "@/utils/budget";
import {
  daysSinceWaste,
  formatPacks,
  monthKey,
  monthlyTotals,
  mostWasted,
  startOfMonth,
  usedByPerson,
  wasteRate,
} from "@/utils/impact";

const MONTHS = 6;

export default function ImpactScreen() {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const householdId = household?.id ?? null;
  const { expenses } = useBudget();

  // The Home tab only needs the latest 50 log entries; Impact needs 6 months of them.
  const [events, setEvents] = useState<PantryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(Date.now()));

  async function load() {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("household_id", householdId)
      .in("type", ["used", "wasted"]) // the only kinds Impact counts
      .gte("at", startOfMonth(MONTHS - 1).toISOString()) // gte = "greater than or equal"
      .order("at", { ascending: false })
      .limit(5000);
    if (error) console.warn("Couldn't load impact:", error.message);
    else setEvents((data as EventRow[]).map(toEvent));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [householdId]);

  // Same live-updates hook as the pantry: new log entries refresh the numbers
  useLiveUpdates("impact", ["events"], householdId, load);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // ---- Everything below is worked out from `events` (see utils/impact.ts) ----
  const months = monthlyTotals(events, MONTHS);
  const thisMonth = months[months.length - 1];
  const rate = wasteRate(thisMonth.used, thisMonth.wasted);
  const streak = daysSinceWaste(events);
  const topWasted = mostWasted(events, 3);
  const thisMonthEvents = events.filter((e) => monthKey(e.at) === thisMonth.key);
  const people = usedByPerson(thisMonthEvents);
  const hasAnyData = months.some((m) => m.used + m.wasted > 0);

  // Money (see utils/budget.ts)
  const spentThisMonth = totalSpent(expenses.filter((e) => monthKey(e.at) === thisMonth.key));
  const myBalance =
    balances(
      expenses,
      members.map((m) => m.userId),
    ).get(session?.user.id ?? "") ?? 0;

  function nameOf(userId: string) {
    if (userId === session?.user.id) return "You";
    return members.find((m) => m.userId === userId)?.name ?? "Someone";
  }

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.bigHeader}>
          <BigHeader title="Impact" />
        </View>
        <SkeletonBlocks />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.bigHeader}>
        <BigHeader
          eyebrow={new Date().toLocaleDateString("en-NZ", { month: "long", year: "numeric" })}
          title="Impact"
        />
      </View>

      {/* ---- This month: the headline ---- */}
      <View style={styles.hero}>
        {/* A soft mint-to-sky wash */}
        <Gradient from={tints.mint.bg} to={tints.sky.bg} />
        <Text style={styles.eyebrow}>THIS MONTH</Text>
        {rate === null ? (
          <Text style={styles.heroEmpty}>
            Use the − buttons, drag levels and tap "Threw it out" in your pantry. Your numbers
            appear here.
          </Text>
        ) : (
          <>
            <View style={styles.heroRow}>
              <Text style={styles.heroNumber}>{Math.round((1 - rate) * 100)}%</Text>
              <Text style={styles.heroCaption}>of your food{"\n"}was used, not wasted</Text>
            </View>
            <View style={styles.statsRow}>
              <Stat value={formatPacks(thisMonth.used)} label="packs used" />
              <Stat value={formatPacks(thisMonth.wasted)} label="packs thrown out" />
              <Stat
                value={streak === null ? "–" : String(streak)}
                label={streak === 1 ? "day since waste" : "days since waste"}
              />
            </View>
          </>
        )}
        <Text style={styles.footnote}>
          1 pack = one full bottle, bag, carton or box. Half a bottle of oil = 0.5.
        </Text>
      </View>

      {/* ---- Last 6 months ---- */}
      {hasAnyData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last {MONTHS} months</Text>
          <MonthlyChart months={months} selectedKey={selectedMonth} onSelect={setSelectedMonth} />
        </View>
      )}

      {/* ---- Thrown out most ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thrown out most</Text>
        {topWasted.length === 0 ? (
          <View style={styles.goodNews}>
            <Ionicons name="leaf" size={20} color={colors.chartUsed} />
            <Text style={styles.body}>Nothing thrown out in the last {MONTHS} months.</Text>
          </View>
        ) : (
          <>
            {topWasted.map((w, i) => (
              <View key={w.name} style={[styles.listRow, i > 0 && styles.divider]}>
                <Text style={styles.listName}>{w.name}</Text>
                <Text style={styles.listValue}>
                  {w.times}× · {formatPacks(w.portion)} packs
                </Text>
              </View>
            ))}
            <Text style={styles.tip}>
              Tip: for things you often throw out, try buying a smaller size, or freezing part of it
              when you get home.
            </Text>
          </>
        )}
      </View>

      {/* ---- Who used what (only for shared households) ---- */}
      {members.length > 1 && people.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Used this month, by person</Text>
          {people.map((p, i) => (
            <View key={p.userId} style={[styles.listRow, i > 0 && styles.divider]}>
              <Text style={styles.listName}>{nameOf(p.userId)}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${(p.packs / people[0].packs) * 100}%` }]}
                />
              </View>
              <Text style={styles.listValue}>{formatPacks(p.packs)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ---- Your calories (only you see this, even in a shared household) ---- */}
      <CaloriesCard variant="week" />

      {/* ---- Spending (if this household uses it) ---- */}
      {household?.spendingEnabled !== false && (
        <Pressable
          onPress={() => router.push("/spending")}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.spendingHeader}>
            <Text style={styles.cardTitle}>Spending</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
          </View>
          <Text style={styles.spendingNumber}>{formatMoney(spentThisMonth)}</Text>
          <Text style={styles.listValue}>spent this month</Text>
          {members.length > 1 && Math.abs(myBalance) >= 0.01 && (
            <Text style={[styles.body, { marginTop: spacing.xs }]}>
              {myBalance > 0
                ? `You're owed ${formatMoney(myBalance)}`
                : `You owe ${formatMoney(-myBalance)}`}
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  bigHeader: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg },
  hero: {
    backgroundColor: colors.card,
    overflow: "hidden",
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, color: colors.textSoft },
  heroEmpty: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 22 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroNumber: { fontFamily: fonts.heading, fontSize: 56, color: colors.text },
  heroCaption: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, lineHeight: 21 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statValue: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  footnote: { fontFamily: fonts.body, fontSize: 11, color: colors.textSoft },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginBottom: 2 },
  body: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  goodNews: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  listName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  listValue: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  tip: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSoft,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  barTrack: {
    flex: 1.4,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.chartUsed },
  spendingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  spendingNumber: { fontFamily: fonts.heading, fontSize: 32, color: colors.text },
});

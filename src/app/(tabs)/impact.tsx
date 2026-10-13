import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { BigHeader } from "@/components/BigHeader";
import { MonthlyChart } from "@/components/MonthlyChart";
import { SkeletonBlocks } from "@/components/Skeleton";
import { useAuth } from "@/state/AuthContext";
import { useBudget } from "@/state/BudgetContext";
import { useHousehold } from "@/state/HouseholdContext";
import { entriesOn, lastDays, useNutrition } from "@/state/NutritionContext";
import { usePreferences } from "@/state/PreferencesContext";
import { INSIGHT_MONTHS, useInsightsEvents } from "@/state/useInsightsEvents";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import { balances, formatMoney, totalSpent } from "@/utils/budget";
import { daysSinceWaste, formatPacks, monthKey, monthlyTotals, wasteRate } from "@/utils/impact";
import { formatKcal, sumMacros } from "@/utils/nutrition";

type IconName = ComponentProps<typeof Ionicons>["name"];

// The Insights tab (the file is still impact.tsx so /impact links keep working).
// Kept simple on purpose: this month's headline, then one row each for the details.
export default function InsightsScreen() {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const { expenses } = useBudget();
  const { entries } = useNutrition();
  const { prefs } = usePreferences();
  const { events, loading, reload } = useInsightsEvents();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(Date.now()));

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  // ---- Food (see utils/impact.ts) ----
  const months = monthlyTotals(events, INSIGHT_MONTHS);
  const thisMonth = months[months.length - 1];
  const rate = wasteRate(thisMonth.used, thisMonth.wasted);
  const streak = daysSinceWaste(events);
  const hasAnyData = months.some((m) => m.used + m.wasted > 0);

  // ---- Calories (only if you track them) ----
  const week = lastDays(7).map((d) => sumMacros(entriesOn(entries, d)).kcal);
  const logged = week.filter((k) => k > 0);
  const avgKcal = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;

  // ---- Spending (only if the household uses it) ----
  const spendingOn = household?.spendingEnabled !== false;
  const spent = totalSpent(expenses.filter((e) => monthKey(e.at) === thisMonth.key));
  const myBalance =
    balances(
      expenses,
      members.map((m) => m.userId),
    ).get(session?.user.id ?? "") ?? 0;

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.bigHeader}>
          <BigHeader title="Insights" />
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
          title="Insights"
        />
      </View>

      {/* ---- The headline: how much food got used rather than binned ---- */}
      <View style={styles.headline}>
        {rate === null ? (
          <Text style={styles.headlineEmpty}>
            Use or bin things in your pantry and this month's numbers appear here.
          </Text>
        ) : (
          <>
            <Text style={styles.headlineNumber}>{Math.round((1 - rate) * 100)}%</Text>
            <Text style={styles.headlineText}>of your food was used this month, not wasted</Text>
            <Text style={styles.headlineMeta}>
              {formatPacks(thisMonth.used)} packs used · {formatPacks(thisMonth.wasted)} thrown out
              {streak !== null && streak > 0
                ? ` · ${streak} ${streak === 1 ? "day" : "days"} since anything was binned`
                : ""}
            </Text>
          </>
        )}
      </View>

      {/* ---- A simple chart: used vs thrown out, month by month ---- */}
      {hasAnyData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Last {INSIGHT_MONTHS} months</Text>
          <MonthlyChart months={months} selectedKey={selectedMonth} onSelect={setSelectedMonth} />
        </View>
      )}

      {/* ---- One row for each area: tap for the details ---- */}
      <View style={styles.card}>
        <Row
          icon="leaf-outline"
          tint="mint"
          title="Food"
          sub="What's thrown out most, and who used what"
          onPress={() => router.push("/insights-details")}
          first
        />
        {prefs.trackCalories && (
          <Row
            icon="flame-outline"
            tint="coral"
            title="Calories"
            sub={
              logged.length
                ? `About ${formatKcal(avgKcal)} kcal a day this week`
                : "Nothing logged this week"
            }
            onPress={() => router.push("/calories")}
          />
        )}
        {spendingOn && (
          <Row
            icon="wallet-outline"
            tint="honey"
            title="Spending"
            sub={
              `${formatMoney(spent)} this month` +
              (members.length > 1 && Math.abs(myBalance) >= 0.01
                ? myBalance > 0
                  ? ` · you're owed ${formatMoney(myBalance)}`
                  : ` · you owe ${formatMoney(-myBalance)}`
                : "")
            }
            onPress={() => router.push("/spending")}
          />
        )}
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  tint,
  title,
  sub,
  onPress,
  first = false,
}: {
  icon: IconName;
  tint: keyof typeof tints;
  title: string;
  sub: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <View style={[styles.rowIcon, { backgroundColor: tints[tint].bg }]}>
        <Ionicons name={icon} size={20} color={tints[tint].icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  bigHeader: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg },
  headline: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  headlineEmpty: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSoft },
  headlineNumber: { fontFamily: fonts.heading, fontSize: 48, lineHeight: 54, color: colors.text },
  headlineText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  headlineMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chartTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 1 },
});

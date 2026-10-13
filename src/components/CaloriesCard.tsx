import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { CalorieGauge } from "@/components/CalorieGauge";
import { PressableScale } from "@/components/PressableScale";

import { entriesOn, lastDays, useNutrition, type Goals } from "@/state/NutritionContext";
import { usePreferences } from "@/state/PreferencesContext";
import { colors, fonts, macroColors, radius, spacing } from "@/theme";
import { toIsoDate } from "@/utils/dates";
import { formatGrams, formatKcal, sumMacros } from "@/utils/nutrition";

// A small calorie summary that opens the full Calories page.
//   "today" (Home):   today's total, a progress bar and macros
//   "week" (Insights):  the daily average and a mini bar for each of the last 7 days
export function CaloriesCard({ variant }: { variant: "today" | "week" }) {
  const { entries, goals, loading } = useNutrition();
  const { prefs } = usePreferences();
  if (loading || !prefs.trackCalories) return null; // calories are an extra, off unless switched on

  const today = toIsoDate(new Date());
  const todayTotals = sumMacros(entriesOn(entries, today));

  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => router.push("/calories")}
      style={styles.card}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="flame-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.title}>
          {variant === "today" ? "Calories & macros" : "Calories this week"}
        </Text>
        {variant === "today" && <Text style={styles.when}>Today</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
      </View>

      {variant === "today" ? (
        <TodayBody kcal={todayTotals.kcal} goals={goals} totals={todayTotals} />
      ) : (
        <WeekBody />
      )}
    </PressableScale>
  );
}

function TodayBody({
  kcal,
  goals,
  totals,
}: {
  kcal: number;
  goals: Goals;
  totals: { protein: number; carbs: number; fat: number };
}) {
  const macros = [
    { label: "Protein", value: totals.protein, goal: goals.protein, color: macroColors.protein },
    { label: "Carbs", value: totals.carbs, goal: goals.carbs, color: macroColors.carbs },
    { label: "Fat", value: totals.fat, goal: goals.fat, color: macroColors.fat },
  ];

  // With a goal: a small dial on the left, a bar for each macro filling the right
  if (goals.kcal) {
    return (
      <View style={styles.dialRow}>
        <CalorieGauge value={kcal} goal={goals.kcal} width={150} />
        <View style={styles.macroCol}>
          {macros.map((m) => {
            // Bars show progress to your macro goal, or just a share of the
            // day's macros if you haven't set one
            const sum = totals.protein + totals.carbs + totals.fat;
            const p = m.goal ? Math.min(1, m.value / m.goal) : sum > 0 ? m.value / sum : 0;
            return (
              <View key={m.label} style={styles.macro}>
                <View style={styles.macroTop}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <Text style={styles.macroValue}>
                    {formatGrams(m.value)}
                    {m.goal ? <Text style={styles.macroGoal}> / {formatGrams(m.goal)}</Text> : null}
                  </Text>
                </View>
                <View style={styles.macroTrack}>
                  <View
                    style={[styles.macroFill, { width: `${p * 100}%`, backgroundColor: m.color }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.big}>
        {formatKcal(kcal)}
        <Text style={styles.bigUnit}> kcal</Text>
      </Text>
      <Text style={styles.meta}>
        {kcal === 0
          ? "Nothing logged yet today. Tap to add food."
          : macros.map((m) => `${m.label} ${formatGrams(m.value)}`).join(" · ")}
      </Text>
    </View>
  );
}

function WeekBody() {
  const { entries, goals } = useNutrition();
  const days = lastDays(7);
  const totals = days.map((d) => sumMacros(entriesOn(entries, d)).kcal);
  const loggedDays = totals.filter((t) => t > 0);
  const average = loggedDays.length ? loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length : 0;
  // Bars are drawn against the biggest day (or the goal, if that's bigger)
  const top = Math.max(...totals, goals.kcal ?? 0, 1);

  return (
    <View style={styles.body}>
      {loggedDays.length === 0 ? (
        <Text style={styles.meta}>Log what you eat to see your week here.</Text>
      ) : (
        <>
          <Text style={styles.big}>
            {formatKcal(average)}
            <Text style={styles.bigUnit}> kcal a day on average</Text>
          </Text>
          <View style={styles.miniChart}>
            {totals.map((t, i) => (
              <View key={days[i]} style={styles.miniCol}>
                <View style={[styles.miniBar, { height: `${Math.max(4, (t / top) * 100)}%` }]} />
              </View>
            ))}
          </View>
          <Text style={styles.meta}>Logged on {loggedDays.length} of the last 7 days</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  when: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  body: { gap: spacing.sm },
  big: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  bigUnit: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  dialRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  macroCol: { flex: 1, gap: spacing.md },
  macro: { gap: 5 },
  macroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  macroLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSoft },
  macroValue: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  macroGoal: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  macroTrack: { height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: "hidden" },
  macroFill: { height: "100%", borderRadius: 3 },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  miniChart: { flexDirection: "row", gap: 6, height: 44, alignItems: "flex-end" },
  miniCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
  miniBar: { borderRadius: 3, backgroundColor: colors.primaryBright },
});

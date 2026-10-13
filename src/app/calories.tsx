import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import Animated from "react-native-reanimated";

import { CalorieGauge } from "@/components/CalorieGauge";
import { Gradient } from "@/components/Gradient";
import { entriesOn, lastDays, useNutrition, type FoodEntry } from "@/state/NutritionContext";
import { colors, fonts, macroColorsOnHero, radius, spacing } from "@/theme";
import { addDays, formatDate, fromIsoDate, toIsoDate } from "@/utils/dates";
import { tap, warning } from "@/utils/haptics";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";
import { formatGrams, formatKcal, progress, sumMacros } from "@/utils/nutrition";
import { formatAmount } from "@/utils/units";

// Opened from the calorie cards on Home and Insights. /calories?day=2026-10-09 opens that day.
export default function CaloriesScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const { entries, goals, refresh, deleteEntry } = useNutrition();

  const today = toIsoDate(new Date());
  const [day, setDay] = useState(params.day ?? today);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Derived ----
  const dayEntries = entriesOn(entries, day);
  const totals = sumMacros(dayEntries);
  const isToday = day === today;
  const week = lastDays(7).map((d) => ({ day: d, ...sumMacros(entriesOn(entries, d)) }));
  const weekTop = Math.max(...week.map((w) => w.kcal), goals.kcal ?? 0, 1);

  function moveDay(by: number) {
    tap();
    setConfirmingId(null);
    // Work from the Date so months roll over properly
    const d = fromIsoDate(day);
    d.setDate(d.getDate() + by);
    setDay(toIsoDate(d));
  }

  function remove(entry: FoodEntry) {
    if (confirmingId !== entry.id) {
      setConfirmingId(entry.id); // first tap: ask
      return;
    }
    warning();
    setConfirmingId(null);
    deleteEntry(entry.id);
  }

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // The dial fills the hero card's width (screen minus the page and card padding)
  const { width: screenW } = useWindowDimensions();
  const gaugeW = Math.min(320, screenW - spacing.lg * 2 - (spacing.lg + 4) * 2);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/nutrition-goals")}
              hitSlop={10}
              accessibilityLabel="Daily goals"
            >
              <Text style={styles.headerLink}>Goals</Text>
            </Pressable>
          ),
        }}
      />

      {/* ---- Which day ---- */}
      <View style={styles.dayRow}>
        <Pressable onPress={() => moveDay(-1)} hitSlop={10} style={styles.dayArrow}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.dayLabel}>
          <Text style={styles.dayTitle}>
            {isToday ? "Today" : day === addDays(-1) ? "Yesterday" : formatDate(day)}
          </Text>
          {!isToday && (
            <Pressable onPress={() => setDay(today)} hitSlop={6}>
              <Text style={styles.backToToday}>Back to today</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => moveDay(1)}
          disabled={isToday} // no logging the future
          hitSlop={10}
          style={[styles.dayArrow, isToday && { opacity: 0.25 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* ---- The day's totals ---- */}
      <View style={styles.hero}>
        <Gradient />
        <Text style={styles.heroEyebrow}>CALORIES</Text>
        {goals.kcal !== null ? (
          // With a goal: a dashboard-style dial
          <View style={styles.gauge}>
            <CalorieGauge value={totals.kcal} goal={goals.kcal} width={gaugeW} tone="hero" />
          </View>
        ) : (
          <>
            <Text style={styles.heroNumber}>
              {formatKcal(totals.kcal)}
              <Text style={styles.heroUnit}> kcal</Text>
            </Text>
            <Pressable onPress={() => router.push("/nutrition-goals")} hitSlop={6}>
              <Text style={styles.heroCaption}>
                Set a daily goal to get a dial here (optional) ›
              </Text>
            </Pressable>
          </>
        )}

        <View style={styles.macros}>
          <Macro
            label="Protein"
            value={totals.protein}
            goal={goals.protein}
            color={macroColorsOnHero.protein}
          />
          <Macro
            label="Carbs"
            value={totals.carbs}
            goal={goals.carbs}
            color={macroColorsOnHero.carbs}
          />
          <Macro label="Fat" value={totals.fat} goal={goals.fat} color={macroColorsOnHero.fat} />
        </View>
      </View>

      {/* ---- Add ---- */}
      <Pressable
        onPress={() => router.push({ pathname: "/food-add", params: { day } })}
        style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={22} color={colors.onPrimary} />
        <Text style={styles.addText}>Add food</Text>
      </Pressable>

      {/* ---- What you ate ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isToday ? "Eaten today" : "Eaten"}</Text>
        {dayEntries.length === 0 ? (
          <Text style={styles.muted}>Nothing logged{isToday ? " yet" : ""}.</Text>
        ) : (
          dayEntries.map((e, i) => (
            <Animated.View
              key={e.id}
              entering={rowEntering(i)}
              exiting={rowExiting}
              layout={rowLayout}
              style={[styles.entryRow, i > 0 && styles.divider]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.entryName}>{e.name}</Text>
                <Text style={styles.entryMeta}>
                  {e.amount !== null && e.unit !== null
                    ? `${formatAmount(e.amount, e.unit)} · `
                    : ""}
                  P {formatGrams(e.protein)} · C {formatGrams(e.carbs)} · F {formatGrams(e.fat)}
                </Text>
              </View>
              <Text style={styles.entryKcal}>{formatKcal(e.kcal)}</Text>
              <Pressable
                onPress={() => remove(e)}
                hitSlop={8}
                style={styles.entryDelete}
                accessibilityLabel={`Remove ${e.name}`}
              >
                {confirmingId === e.id ? (
                  <Text style={styles.confirmText}>Remove?</Text>
                ) : (
                  <Ionicons name="close" size={18} color={colors.textSoft} />
                )}
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>

      {/* ---- Last 7 days ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 7 days</Text>
        <View style={styles.chart}>
          {/* The goal, drawn as a line across the bars */}
          {goals.kcal !== null && (
            <View
              style={[styles.goalLine, { bottom: LABEL_H + (goals.kcal / weekTop) * BAR_AREA_H }]}
            />
          )}
          {week.map((w) => (
            <Pressable
              key={w.day}
              onPress={() => {
                tap();
                setDay(w.day);
              }}
              style={styles.chartCol}
              accessibilityLabel={`${formatDate(w.day)}: ${formatKcal(w.kcal)} kcal`}
            >
              <View style={styles.chartBarArea}>
                <View
                  style={[
                    styles.chartBar,
                    { height: `${Math.max(2, (w.kcal / weekTop) * 100)}%` },
                    w.day === day && styles.chartBarSelected,
                  ]}
                />
              </View>
              <Text style={[styles.chartLabel, w.day === day && styles.chartLabelSelected]}>
                {fromIsoDate(w.day).toLocaleDateString("en-NZ", { weekday: "narrow" })}
              </Text>
            </Pressable>
          ))}
        </View>
        {goals.kcal !== null && <Text style={styles.muted}>The dashed line is your goal.</Text>}
      </View>
    </ScrollView>
  );
}

// One macro under the big number: "Protein 45 g / 120 g" with a thin bar if there's a goal
function Macro({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number | null;
  color: string;
}) {
  const p = progress(value, goal);
  return (
    <View style={styles.macro}>
      <View style={styles.macroHead}>
        <View style={[styles.macroDot, { backgroundColor: color }]} />
        <Text style={styles.macroLabel}>{label}</Text>
      </View>
      <Text style={styles.macroValue}>
        {formatGrams(value)}
        {goal ? <Text style={styles.macroGoal}> / {formatGrams(goal)}</Text> : null}
      </Text>
      {p !== null && (
        <View style={styles.macroTrack}>
          <View style={[styles.macroFill, { width: `${p * 100}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

// The week chart: bar area + the row of day letters under it (in pixels)
const BAR_AREA_H = 120;
const LABEL_H = 22;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerLink: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primary },

  dayRow: { flexDirection: "row", alignItems: "center" },
  dayArrow: { padding: spacing.sm },
  dayLabel: { flex: 1, alignItems: "center", gap: 2 },
  dayTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  backToToday: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },

  hero: {
    backgroundColor: colors.hero,
    overflow: "hidden", // keeps the gradient inside the rounded corners
    borderRadius: radius.xl,
    padding: spacing.lg + 4,
    gap: spacing.sm,
  },
  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onHeroSoft,
  },
  heroNumber: { fontFamily: fonts.heading, fontSize: 48, lineHeight: 54, color: colors.onHero },
  heroUnit: { fontFamily: fonts.body, fontSize: 18, color: colors.onHeroSoft },
  gauge: { alignItems: "center", marginTop: spacing.xs },
  heroCaption: { fontFamily: fonts.body, fontSize: 14, color: colors.onHeroSoft },
  macros: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  macro: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 4,
  },
  macroHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.onHeroSoft },
  macroValue: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onHero },
  macroGoal: { fontFamily: fonts.body, fontSize: 12, color: colors.onHeroSoft },
  macroTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  macroFill: { height: "100%", borderRadius: 3, backgroundColor: colors.onHeroSoft },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },

  entryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  entryName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  entryMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  entryKcal: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  entryDelete: { minWidth: 28, alignItems: "flex-end" },
  confirmText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.urgent },

  chart: { flexDirection: "row", gap: spacing.sm, height: BAR_AREA_H + LABEL_H },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.textSoft,
  },
  chartCol: { flex: 1 },
  chartBarArea: { flex: 1, justifyContent: "flex-end" },
  chartBar: { borderRadius: 4, backgroundColor: colors.primarySoft },
  chartBarSelected: { backgroundColor: colors.primaryBright },
  chartLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textSoft,
    textAlign: "center",
    height: LABEL_H,
    paddingTop: 6,
  },
  chartLabelSelected: { color: colors.text },
});

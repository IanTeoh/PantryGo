import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { INSIGHT_MONTHS, useInsightsEvents } from "@/state/useInsightsEvents";
import { colors, fonts, radius, spacing } from "@/theme";
import { formatPacks, monthKey, monthlyTotals, mostWasted, usedByPerson } from "@/utils/impact";

// Insights → Food: the detail behind the headline number.
export default function InsightsDetailsScreen() {
  const { session } = useAuth();
  const { members } = useHousehold();
  const { events, loading } = useInsightsEvents();

  const months = monthlyTotals(events, INSIGHT_MONTHS);
  const thisMonth = months[months.length - 1];
  const topWasted = mostWasted(events, 3);
  const people = usedByPerson(events.filter((e) => monthKey(e.at) === thisMonth.key));

  const nameOf = (userId: string) =>
    userId === session?.user.id
      ? "You"
      : (members.find((m) => m.userId === userId)?.name ?? "Someone");

  if (loading) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ---- Thrown out most ---- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Thrown out most</Text>
        {topWasted.length === 0 ? (
          <View style={styles.goodNews}>
            <Ionicons name="leaf" size={20} color={colors.chartUsed} />
            <Text style={styles.body}>Nothing thrown out in the last {INSIGHT_MONTHS} months.</Text>
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
            <Text style={styles.muted}>
              Tip: try a smaller size of these, or freeze some when you get home.
            </Text>
          </>
        )}
      </View>

      {/* ---- Who used what (shared households only) ---- */}
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

      <Text style={styles.muted}>
        1 pack = one full bottle, bag, carton or box. Half a bottle of oil = 0.5.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, marginBottom: 2 },
  body: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  muted: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  goodNews: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  listValue: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  barTrack: {
    flex: 1.4,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.chartUsed },
});

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";
import { formatPacks, wasteRate, type MonthTotals } from "@/utils/impact";

const CHART_HEIGHT = 140; // pixels for the tallest column
const COLUMN_WIDTH = 24; // thin columns, with air around them
const GAP = 2; // white gap between the used and thrown-out parts of a column

// A column per month: used (green) at the bottom, thrown out (red-orange) on top.
// Tap a column to see its numbers underneath.
export function MonthlyChart({
  months,
  selectedKey,
  onSelect,
}: {
  months: MonthTotals[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  // Scale: the biggest month fills the chart height. (At least 1, to avoid dividing by 0.)
  const max = Math.max(1, ...months.map((m) => m.used + m.wasted));
  const toPixels = (packs: number) => (packs / max) * CHART_HEIGHT;

  const selected = months.find((m) => m.key === selectedKey) ?? months[months.length - 1];
  const rate = wasteRate(selected.used, selected.wasted);

  return (
    <View style={styles.wrap}>
      {/* Legend: always shown for two series, so colour isn't the only clue */}
      <View style={styles.legend}>
        <LegendKey color={colors.chartUsed} label="Used" />
        <LegendKey color={colors.chartWasted} label="Thrown out" />
      </View>

      {/* Top gridline, labelled with the biggest value */}
      <View style={styles.plot}>
        <View style={[styles.gridline, { bottom: CHART_HEIGHT }]} />
        <Text style={[styles.gridLabel, { bottom: CHART_HEIGHT + 2 }]}>
          {formatPacks(max)} packs
        </Text>

        <View style={styles.columns}>
          {months.map((m) => {
            const isSelected = m.key === selected.key;
            const usedH = toPixels(m.used);
            const wastedH = toPixels(m.wasted);
            return (
              // The whole slot is tappable, not just the thin column: easier to hit
              <Pressable
                key={m.key}
                onPress={() => onSelect(m.key)}
                style={styles.slot}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}: ${formatPacks(m.used)} packs used, ${formatPacks(m.wasted)} thrown out`}
              >
                <View style={[styles.column, !isSelected && { opacity: 0.45 }]}>
                  {wastedH > 0 && (
                    <View
                      style={[
                        styles.segment,
                        styles.topRounded,
                        { height: wastedH, backgroundColor: colors.chartWasted },
                      ]}
                    />
                  )}
                  {wastedH > 0 && usedH > 0 && <View style={{ height: GAP }} />}
                  {usedH > 0 && (
                    <View
                      style={[
                        styles.segment,
                        wastedH === 0 && styles.topRounded, // round whichever part is on top
                        { height: usedH, backgroundColor: colors.chartUsed },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        {/* Baseline */}
        <View style={styles.baseline} />
      </View>

      {/* Month names */}
      <View style={styles.labels}>
        {months.map((m) => (
          <Text key={m.key} style={[styles.month, m.key === selected.key && styles.monthSelected]}>
            {m.label}
          </Text>
        ))}
      </View>

      {/* The selected month's numbers: the "tooltip" for a touch screen */}
      <Text style={styles.detail}>
        <Text style={styles.detailStrong}>{selected.label}: </Text>
        {formatPacks(selected.used)} packs used · {formatPacks(selected.wasted)} thrown out
        {rate !== null ? ` · ${Math.round(rate * 100)}% wasted` : ""}
      </Text>
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  legend: { flexDirection: "row", gap: spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  plot: { height: CHART_HEIGHT + 18, justifyContent: "flex-end" },
  gridline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  gridLabel: {
    position: "absolute",
    left: 0,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSoft,
  },
  columns: { flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT },
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  column: { width: COLUMN_WIDTH },
  segment: { width: COLUMN_WIDTH },
  topRounded: { borderTopLeftRadius: 4, borderTopRightRadius: 4 }, // square at the baseline
  baseline: { height: 1, backgroundColor: colors.border },
  labels: { flexDirection: "row" },
  month: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSoft,
  },
  monthSelected: { fontFamily: fonts.bodyBold, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: spacing.xs },
  detailStrong: { fontFamily: fonts.bodyBold },
});

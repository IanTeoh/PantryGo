import { StyleSheet, Text } from "react-native";

import { colors, fonts, radius } from "@/theme";
import type { Item } from "@/types";
import { daysUntil, formatDate } from "@/utils/dates";

// The little label under an item's name: "Use today", "Tomorrow", "3 days", or a date.
// Red-ish for today/expired, honey for this week, plain for later.
export function StatusPill({ item }: { item: Item }) {
  if (item.expiry === null) return null;
  const days = daysUntil(item.expiry);

  let text: string;
  let tone: "urgent" | "soon" | "plain";
  if (days < 0) [text, tone] = ["Expired", "urgent"];
  else if (days === 0) [text, tone] = ["Use today", "urgent"];
  else if (days === 1) [text, tone] = ["Tomorrow", "soon"];
  else if (days <= 3) [text, tone] = [`${days} days`, "soon"];
  else if (days <= 14) [text, tone] = [`${days} days`, "plain"];
  else [text, tone] = [formatDate(item.expiry), "plain"];

  return (
    <Text style={[styles.pill, tone === "urgent" && styles.urgent, tone === "soon" && styles.soon]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden", // keeps the rounded corners on iPhone
  },
  urgent: { backgroundColor: colors.urgentBg, color: colors.urgent },
  soon: { backgroundColor: colors.soonBg, color: colors.soon },
});

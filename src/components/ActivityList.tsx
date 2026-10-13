import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import type { PantryEvent } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { describeEvent } from "@/utils/describeEvent";
import { timeAgo } from "@/utils/timeAgo";

// Soft tile colours for people's initials, so each housemate has their own
const AVATAR_TONES = [
  { bg: colors.tileFridge, fg: colors.iconFridge },
  { bg: colors.tilePantry, fg: colors.iconPantry },
  { bg: colors.tileFreezer, fg: colors.iconFreezer },
  { bg: colors.soonBg, fg: colors.soon },
];

// A card listing activity-log entries: "Used 120 ml of Olive oil · Sam · 5 min ago".
// Used on the Home tab and on each item's page.
export function ActivityList({ events, emptyText }: { events: PantryEvent[]; emptyText: string }) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const me = session?.user.id;

  function person(userId: string | null) {
    if (userId === null) return { name: "Someone", initial: "?", isMe: false, index: 0 };
    const index = Math.max(
      0,
      members.findIndex((m) => m.userId === userId),
    );
    const name =
      userId === me ? "You" : (members.find((m) => m.userId === userId)?.name ?? "Someone");
    const realName = members.find((m) => m.userId === userId)?.name ?? name;
    return { name, initial: realName.charAt(0).toUpperCase(), isMe: userId === me, index };
  }

  return (
    <View style={styles.card}>
      {events.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        events.map((event, i) => {
          const p = person(event.userId);
          const tone = AVATAR_TONES[p.index % AVATAR_TONES.length];
          return (
            <View key={event.id} style={[styles.row, i > 0 && styles.divider]}>
              <View
                style={[
                  styles.avatar,
                  p.isMe ? { backgroundColor: colors.primary } : { backgroundColor: tone.bg },
                ]}
              >
                <Text style={[styles.avatarText, { color: p.isMe ? colors.onPrimary : tone.fg }]}>
                  {p.initial}
                </Text>
              </View>
              <View style={styles.texts}>
                <Text style={styles.text}>{describeEvent(event)}</Text>
                <Text style={styles.meta}>
                  {p.name} · {timeAgo(event.at)}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    paddingVertical: spacing.lg,
    lineHeight: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  texts: { flex: 1, gap: 2 },
  text: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
});

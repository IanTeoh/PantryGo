import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import type { PantryEvent } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { describeEvent } from "@/utils/describeEvent";
import { timeAgo } from "@/utils/timeAgo";

// Soft tile colours for people's initials (when they have no photo), so each housemate has their own
const AVATAR_TONES = [
  { bg: colors.tileFridge, fg: colors.iconFridge },
  { bg: colors.tilePantry, fg: colors.iconPantry },
  { bg: colors.tileFreezer, fg: colors.iconFreezer },
  { bg: colors.soonBg, fg: colors.soon },
];

// A card listing activity-log entries: "Used 120 ml of Olive oil · Sam · 5 min ago".
// Used on the Home tab and on each item's page. Tap one for the details, and Undo.
export function ActivityList({ events, emptyText }: { events: PantryEvent[]; emptyText: string }) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const me = session?.user.id;

  function person(userId: string | null) {
    if (userId === null)
      return { name: "Someone", realName: "?", avatar: null, isMe: false, index: 0 };
    const index = Math.max(
      0,
      members.findIndex((m) => m.userId === userId),
    );
    const name =
      userId === me ? "You" : (members.find((m) => m.userId === userId)?.name ?? "Someone");
    const member = members.find((m) => m.userId === userId);
    const realName = member?.name ?? name;
    return { name, realName, avatar: member?.avatar ?? null, isMe: userId === me, index };
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
            <Pressable
              key={event.id}
              onPress={() => router.push({ pathname: "/activity/[id]", params: { id: event.id } })}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.divider,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityHint="Shows the details, and lets you undo it"
            >
              <Avatar
                name={p.realName}
                photo={p.avatar}
                size={32}
                background={p.isMe ? colors.primary : tone.bg}
                color={p.isMe ? colors.onPrimary : tone.fg}
                font={fonts.bodyBold}
              />
              <View style={styles.texts}>
                <Text style={styles.text}>{describeEvent(event)}</Text>
                <Text style={styles.meta}>
                  {p.name} · {timeAgo(event.at)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
            </Pressable>
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
  texts: { flex: 1, gap: 2 },
  text: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
});

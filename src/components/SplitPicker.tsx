import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { formatMoney } from "@/utils/budget";
import { tick } from "@/utils/haptics";

// "Who's it for?" Tap people in or out of a cost's split.
// E.g. milk for you, Tom and Jerry, but not Max (he doesn't drink it).
// Everyone in the split pays an equal share; just you = it's not split at all.
export function SplitPicker({
  selected,
  onChange,
  amount,
}: {
  selected: string[]; // user ids in the split
  onChange: (next: string[]) => void;
  amount?: number; // to show "$2.00 each"
}) {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const me = session?.user.id;

  // Keep the selection valid: if it has nobody from this household in it (e.g. the
  // members hadn't loaded yet, or you switched household), start again with everyone
  const ids = members.map((m) => m.userId).join(",");
  useEffect(() => {
    if (members.length > 0 && !selected.some((id) => members.some((m) => m.userId === id))) {
      onChange(members.map((m) => m.userId));
    }
  }, [ids]);

  // You first, then everyone else A–Z
  const people = [...members].sort((a, b) =>
    a.userId === me ? -1 : b.userId === me ? 1 : a.name.localeCompare(b.name),
  );
  const everyone = people.map((p) => p.userId);
  const allOn = everyone.every((id) => selected.includes(id));
  const onlyMe = selected.length === 1 && selected[0] === me;

  function toggle(id: string) {
    tick();
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next.length === 0 ? selected : next); // never empty: someone has to pay for it
  }

  const each = amount && amount > 0 && selected.length > 0 ? amount / selected.length : null;
  const summary = onlyMe
    ? "Just for you, so it isn't split"
    : allOn
      ? `Split between everyone${each ? ` · ${formatMoney(each)} each` : ""}`
      : `Split ${selected.length} ways${each ? ` · ${formatMoney(each)} each` : ""}`;

  // Just you in this household: nothing to split yet, so say how to change that
  if (members.length <= 1) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Who's it for?</Text>
        <View style={styles.soloCard}>
          <Text style={styles.soloText}>
            It's just you in {household?.name ?? "this household"}, so this is all yours. Invite
            flatmates to split costs with them.
          </Text>
          {household && (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/household/[id]", params: { id: household.id } })
              }
              hitSlop={8}
            >
              <Text style={styles.soloLink}>Get the invite code</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Who's it for?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {/* Shortcuts */}
        <PressableScale
          scaleTo={0.92}
          onPress={() => {
            tick();
            onChange(everyone);
          }}
          style={[styles.shortcut, allOn && styles.shortcutOn]}
        >
          <Text style={[styles.shortcutText, allOn && styles.shortcutTextOn]}>Everyone</Text>
        </PressableScale>
        {me && (
          <PressableScale
            scaleTo={0.92}
            onPress={() => {
              tick();
              onChange([me]);
            }}
            style={[styles.shortcut, onlyMe && styles.shortcutOn]}
          >
            <Text style={[styles.shortcutText, onlyMe && styles.shortcutTextOn]}>Just me</Text>
          </PressableScale>
        )}
        <View style={styles.sep} />

        {/* Each person: tap to include or leave out */}
        {people.map((p) => {
          const on = selected.includes(p.userId);
          return (
            <PressableScale
              key={p.userId}
              scaleTo={0.92}
              onPress={() => toggle(p.userId)}
              style={[styles.person, on && styles.personOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.userId === me ? "Me" : p.name}
            >
              <View style={[styles.avatar, on && styles.avatarOn]}>
                <Text style={[styles.avatarText, on && styles.avatarTextOn]}>
                  {on ? "✓" : p.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.personText, !on && styles.personTextOff]}>
                {p.userId === me ? "Me" : p.name.split(" ")[0]}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: spacing.lg,
  },
  soloCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  soloText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text },
  soloLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  shortcut: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shortcutOn: { backgroundColor: colors.text, borderColor: colors.text },
  shortcutText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  shortcutTextOn: { color: colors.background },
  sep: { width: 1, height: 24, backgroundColor: colors.border },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personOn: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOn: { backgroundColor: colors.primary },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textSoft },
  avatarTextOn: { color: colors.onPrimary },
  personText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  personTextOff: { color: colors.textSoft, textDecorationLine: "line-through" },
  summary: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSoft,
    paddingHorizontal: spacing.lg,
  },
});

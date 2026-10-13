import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActivityList } from "@/components/ActivityList";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/state/HouseholdContext";
import { toEvent, type EventRow, type PantryEvent } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { addDays, toIsoDate } from "@/utils/dates";

const PAGE = 50; // entries per page

// Home → Recent → See all: the household's whole activity log, newest first,
// grouped by day. Tap an entry for its details (and Undo).
export default function AllActivityScreen() {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;

  const [events, setEvents] = useState<PantryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function fetchPage(from: number) {
    if (!householdId) return [];
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("household_id", householdId)
      .order("at", { ascending: false })
      .range(from, from + PAGE - 1); // rows from..to, counting from 0
    if (error) {
      console.warn("Couldn't load activity:", error.message);
      return [];
    }
    const page = (data as EventRow[]).map(toEvent);
    setHasMore(page.length === PAGE);
    return page;
  }

  // Each time this page comes into view (e.g. back from undoing something): reload
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchPage(0).then((page) => {
        if (cancelled) return;
        setEvents(page);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [householdId]),
  );

  async function loadMore() {
    setLoadingMore(true);
    const page = await fetchPage(events.length);
    setEvents((prev) => [...prev, ...page.filter((e) => !prev.some((p) => p.id === e.id))]);
    setLoadingMore(false);
  }

  // Group by day: Today, Yesterday, then dates
  const today = toIsoDate(new Date());
  const yesterday = addDays(-1);
  const days: { key: string; label: string; events: PantryEvent[] }[] = [];
  for (const e of events) {
    const key = toIsoDate(new Date(e.at));
    let group = days.find((d) => d.key === key);
    if (!group) {
      group = {
        key,
        label:
          key === today
            ? "Today"
            : key === yesterday
              ? "Yesterday"
              : new Date(e.at).toLocaleDateString("en-NZ", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
        events: [],
      };
      days.push(group);
    }
    group.events.push(e);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {days.length === 0 ? (
        <Text style={styles.muted}>Nothing yet. Add or use something in your pantry.</Text>
      ) : (
        days.map((d) => (
          <View key={d.key} style={styles.day}>
            <Text style={styles.dayLabel}>{d.label.toUpperCase()}</Text>
            <ActivityList events={d.events} emptyText="" />
          </View>
        ))
      )}
      {hasMore && days.length > 0 && (
        <Pressable onPress={loadMore} disabled={loadingMore} style={styles.more}>
          {loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.moreText}>Show older</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  day: { gap: spacing.sm },
  dayLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textSoft,
  },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, textAlign: "center" },
  more: {
    alignSelf: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  moreText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { tick, warning } from "@/utils/haptics";
import { rowEntering } from "@/utils/motion";

// /household/abc… : one household's people, with the owner (who made it) first.
// Works for any household you're in, not just the one you're looking at now.

type Person = {
  userId: string;
  name: string;
  role: "admin" | "member";
  joinedAt: number;
};

type Details = {
  name: string;
  inviteCode: string;
  ownerId: string;
  createdAt: number;
  people: Person[];
};

export default function HouseholdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const {
    household: current,
    households,
    switchHousehold,
    setSpendingEnabled,
    leaveHousehold,
  } = useHousehold();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const me = session?.user.id;

  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    // Three small queries: the household, who's in it, and their names.
    // The database's rules only answer if you're a member, so nobody else can look.
    const [hh, memberRows] = await Promise.all([
      supabase
        .from("households")
        .select("name, invite_code, created_by, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("household_members").select("user_id, role, joined_at").eq("household_id", id),
    ]);
    if (hh.error || memberRows.error || !hh.data) {
      setError(hh.error?.message ?? memberRows.error?.message ?? "You're not in this household.");
      return;
    }
    const ids = (memberRows.data ?? []).map((m) => m.user_id as string);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);

    const ownerId = hh.data.created_by as string;
    const people: Person[] = (memberRows.data ?? []).map((m) => ({
      userId: m.user_id as string,
      role: m.role as "admin" | "member",
      joinedAt: Date.parse(m.joined_at as string),
      name: profiles?.find((p) => p.id === m.user_id)?.display_name || "Someone",
    }));
    // Owner first, then everyone in the order they joined
    people.sort(
      (a, b) =>
        Number(b.userId === ownerId) - Number(a.userId === ownerId) || a.joinedAt - b.joinedAt,
    );

    setError(null);
    setDetails({
      name: hh.data.name as string,
      inviteCode: hh.data.invite_code as string,
      ownerId,
      createdAt: Date.parse(hh.data.created_at as string),
      people,
    });
  }

  useEffect(() => {
    load();
  }, [id]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!details) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: "Household" }} />
        {error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const owner = details.people.find((p) => p.userId === details.ownerId);
  const isCurrent = current?.id === id;
  const since = (ms: number) =>
    new Date(ms).toLocaleDateString("en-NZ", { month: "short", year: "numeric" });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Stack.Screen options={{ title: "" }} />

      {/* ---- Title ---- */}
      <View style={styles.titleBlock}>
        <View style={styles.bigAvatar}>
          <Text style={styles.bigAvatarText}>{details.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{details.name}</Text>
        <Text style={styles.muted}>
          {details.people.length} {details.people.length === 1 ? "person" : "people"} · started{" "}
          {since(details.createdAt)}
        </Text>
        {isCurrent ? (
          <Text style={styles.currentTag}>You're looking at this household</Text>
        ) : (
          <Pressable
            onPress={() => {
              tick();
              switchHousehold(id);
              router.back();
            }}
            style={({ pressed }) => [styles.switchButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="swap-horizontal" size={18} color={colors.onPrimary} />
            <Text style={styles.switchText}>Switch to this household</Text>
          </Pressable>
        )}
      </View>

      {/* ---- Owner ---- */}
      <View style={styles.section}>
        <Text style={styles.label}>OWNER</Text>
        <View style={styles.card}>
          {owner ? (
            <PersonRow person={owner} isMe={owner.userId === me} owner since={since} />
          ) : (
            <Text style={[styles.muted, { padding: spacing.md }]}>
              The person who started this household has left it.
            </Text>
          )}
        </View>
      </View>

      {/* ---- Everyone else ---- */}
      <View style={styles.section}>
        <Text style={styles.label}>MEMBERS</Text>
        <View style={styles.card}>
          {details.people.filter((p) => p.userId !== details.ownerId).length === 0 ? (
            <Text style={[styles.muted, { padding: spacing.md }]}>
              Nobody else yet. Share the invite code below.
            </Text>
          ) : (
            details.people
              .filter((p) => p.userId !== details.ownerId)
              .map((p, i) => (
                <Animated.View key={p.userId} entering={rowEntering(i)}>
                  <PersonRow person={p} isMe={p.userId === me} since={since} divider={i > 0} />
                </Animated.View>
              ))
          )}
        </View>
      </View>

      {/* ---- Features: spending on or off (the owner decides) ---- */}
      <View style={styles.section}>
        <Text style={styles.label}>FEATURES</Text>
        <View style={[styles.card, styles.featureCard]}>
          <View style={styles.featureRow}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>Spending & splitting costs</Text>
              <Text style={styles.muted}>
                Prices, receipt totals, the spending log and who owes whom.
                {details.ownerId === me ? "" : " Only the owner can change this."}
              </Text>
            </View>
            {(() => {
              const on = households.find((h) => h.id === id)?.spendingEnabled !== false;
              const canChange = details.ownerId === me;
              return (
                <Pressable
                  onPress={async () => {
                    if (!canChange) return;
                    tick();
                    setSwitchError(await setSpendingEnabled(id, !on));
                  }}
                  disabled={!canChange}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on, disabled: !canChange }}
                  style={[styles.toggle, on && styles.toggleOn, !canChange && { opacity: 0.5 }]}
                >
                  <View style={[styles.knob, on && styles.knobOn]} />
                </Pressable>
              );
            })()}
          </View>
          {switchError && <Text style={styles.error}>{switchError}</Text>}
        </View>
      </View>

      {/* ---- Invite ---- */}
      <View style={styles.inviteCard}>
        <Text style={styles.muted}>Invite code</Text>
        <Text style={styles.code} selectable>
          {details.inviteCode}
        </Text>
        <Pressable
          onPress={() =>
            Share.share({
              message: `Join "${details.name}" on PantryGo with the code ${details.inviteCode}`,
            })
          }
          style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={styles.shareText}>Share invite</Text>
        </Pressable>
      </View>
      {/* ---- Leave ---- */}
      <Pressable
        onPress={async () => {
          if (!confirmLeave) {
            warning();
            setConfirmLeave(true); // first tap: ask
            return;
          }
          const err = await leaveHousehold(id);
          if (err) setSwitchError(err);
          else router.back();
        }}
        style={styles.leaveButton}
      >
        <Text style={styles.leaveText}>
          {confirmLeave ? `Tap again to leave ${details.name}` : `Leave ${details.name}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function PersonRow({
  person,
  isMe,
  owner = false,
  divider = false,
  since,
}: {
  person: Person;
  isMe: boolean;
  owner?: boolean;
  divider?: boolean;
  since: (ms: number) => string;
}) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={[styles.avatar, owner && styles.avatarOwner]}>
        <Text style={[styles.avatarText, owner && styles.avatarTextOwner]}>
          {person.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {person.name}
          {isMe && <Text style={styles.you}> (you)</Text>}
        </Text>
        <Text style={styles.muted}>
          {owner ? `Started it · ${since(person.joinedAt)}` : `Joined ${since(person.joinedAt)}`}
        </Text>
      </View>
      {owner && (
        <View style={styles.ownerBadge}>
          <Ionicons name="star" size={12} color={colors.onPrimary} />
          <Text style={styles.ownerBadgeText}>Owner</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },

  titleBlock: { alignItems: "center", gap: 6 },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  bigAvatarText: { fontFamily: fonts.heading, fontSize: 32, color: colors.onPrimary },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text, textAlign: "center" },
  currentTag: {
    marginTop: spacing.xs,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    overflow: "hidden",
  },
  switchButton: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  switchText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },

  section: { gap: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: colors.textSoft },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOwner: { backgroundColor: colors.primary },
  avatarText: { fontFamily: fonts.heading, fontSize: 17, color: colors.primary },
  avatarTextOwner: { color: colors.onPrimary },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  you: { fontFamily: fonts.body, color: colors.textSoft },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ownerBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPrimary },

  featureCard: { paddingVertical: spacing.md, gap: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3 },
  toggleOn: { backgroundColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 20 }] },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent },
  leaveButton: { alignItems: "center", padding: spacing.md },
  leaveText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.urgent },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  code: { fontFamily: fonts.bodyBold, fontSize: 30, letterSpacing: 8, color: colors.primary },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  shareText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
});

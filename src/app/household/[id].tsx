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

import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { loadProfiles, useHousehold } from "@/state/HouseholdContext";
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
  avatar: string | null;
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
    const profiles = await loadProfiles(ids);

    const ownerId = hh.data.created_by as string;
    const people: Person[] = (memberRows.data ?? []).map((m) => ({
      userId: m.user_id as string,
      role: m.role as "admin" | "member",
      joinedAt: Date.parse(m.joined_at as string),
      name: profiles.find((p) => p.id === m.user_id)?.display_name || "Someone",
      avatar: profiles.find((p) => p.id === m.user_id)?.avatar ?? null,
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
        {/* Its picture: tap to change (anyone in the household can) */}
        <Pressable
          onPress={() => {
            tick();
            router.push({ pathname: "/avatar", params: { household: id } });
          }}
          style={({ pressed }) => [styles.bigAvatar, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Change the household's picture"
        >
          <Avatar
            name={details.name}
            photo={households.find((h) => h.id === id)?.photo}
            bucket="household-photos"
            shape="rounded"
            size={72}
          />
          <View style={styles.bigAvatarBadge}>
            <Ionicons name="camera" size={13} color={colors.onPrimary} />
          </View>
        </Pressable>
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

      {/* ---- Features: split costs on or off, for the whole household (anyone in it) ---- */}
      <View style={styles.section}>
        <Text style={styles.label}>FEATURES</Text>
        <View style={[styles.card, styles.featureCard]}>
          <View style={styles.featureRow}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>Split costs</Text>
              <Text style={styles.muted}>
                Prices, the spending log and who owes whom. Anyone here can switch it, and it's on
                or off for everyone.
              </Text>
            </View>
            {(() => {
              const on = households.find((h) => h.id === id)?.spendingEnabled !== false;
              return (
                <Pressable
                  onPress={async () => {
                    tick();
                    setSwitchError(await setSpendingEnabled(id, !on));
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  style={[styles.toggle, on && styles.toggleOn]}
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
      <Avatar
        name={person.name}
        photo={person.avatar}
        size={40}
        background={owner ? colors.primary : colors.card}
        color={owner ? colors.onPrimary : colors.primary}
      />
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
  bigAvatar: { marginBottom: spacing.xs },
  bigAvatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
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
  code: { fontFamily: fonts.bodyBold, fontSize: 30, letterSpacing: 5, color: colors.primary },
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

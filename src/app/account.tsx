import Ionicons from "@expo/vector-icons/Ionicons";
import { reloadAppAsync } from "expo";
import Constants from "expo-constants";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TextInput } from "@/components/TextInput";

import { FilterChips } from "@/components/FilterChips";
import { PressableScale } from "@/components/PressableScale";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { useCommunity } from "@/state/CommunityContext";
import { CONTACT_EMAIL, hasContactEmail } from "@/data/legal";
import { useHousehold } from "@/state/HouseholdContext";
import { useNutrition } from "@/state/NutritionContext";
import { usePreferences } from "@/state/PreferencesContext";
import { useReminders } from "@/state/RemindersContext";
import { readItemView, saveItemView, type ItemView } from "@/utils/itemView";
import { cuisineLabel } from "@/utils/recipeMeta";
import { colors, fonts, radius, saveThemeChoice, spacing, themeChoice } from "@/theme";
import { success, tick, warning } from "@/utils/haptics";

type IconName = ComponentProps<typeof Ionicons>["name"];

const WHEN_OPTIONS = [
  { value: "0", label: "On the day" },
  { value: "1", label: "1 day before" },
  { value: "2", label: "2 days before" },
];

const TIME_OPTIONS = [7, 8, 9, 12, 18].map((h) => ({
  value: String(h),
  label: h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`,
}));

// Your profile and settings. Opened from your initial at the top of the tabs.
export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { household, households, switchHousehold, refresh } = useHousehold();
  const reminders = useReminders();

  const user = session?.user;
  const name = (user?.user_metadata?.display_name as string | undefined) || "You";

  // ---- Editing your name ----
  const [editing, setEditing] = useState(false);
  const [nameText, setNameText] = useState(name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function saveName() {
    const clean = nameText.trim();
    if (!clean || !user) return;
    setSavingName(true);
    // Two places: your sign-in details (for "Good morning, Ian") and your profile
    // (what flatmates see). The database lets you change only your own.
    const [a, b] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: clean } }),
      supabase.from("profiles").update({ display_name: clean }).eq("id", user.id),
    ]);
    setSavingName(false);
    const error = a.error?.message ?? b.error?.message ?? null;
    setNameError(error);
    if (!error) {
      success();
      setEditing(false);
      refresh(); // so your new name shows in household lists too
    }
  }

  // ---- Reminders ----
  const remindersOn = reminders.prefs.enabled && reminders.permission === "granted";
  const blocked = reminders.permission === "denied";

  async function toggleReminders() {
    tick();
    if (remindersOn) reminders.updatePrefs({ enabled: false });
    else await reminders.turnOn(); // asks the phone the first time
  }

  // ---- Appearance ----

  // ---- Deleting your account ----
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const ownedWithOthers = households.filter((h) => h.ownerId === user?.id);

  async function deleteAccount() {
    if (deleteStep === 0) {
      warning();
      setDeleteStep(1); // first tap: explain what happens
      return;
    }
    setDeleting(true);
    const { error } = await supabase.rpc("delete_my_account");
    setDeleting(false);
    if (error) {
      setDeleteError(
        error.message.includes("delete_my_account")
          ? "Account deletion isn't set up yet: run 12_account.sql in Supabase."
          : error.message,
      );
      return;
    }
    await signOut(); // the account is gone; the app goes back to the sign-in screen
  }

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* ---- You ---- */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        {editing ? (
          <View style={styles.nameEdit}>
            <TextInput
              value={nameText}
              onChangeText={setNameText}
              autoFocus
              autoCapitalize="words"
              style={styles.nameInput}
              onSubmitEditing={saveName}
              maxLength={40}
            />
            <View style={styles.nameButtons}>
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setNameText(name);
                }}
                hitSlop={8}
              >
                <Text style={styles.linkSoft}>Cancel</Text>
              </Pressable>
              <PressableScale
                scaleTo={0.95}
                onPress={saveName}
                disabled={!nameText.trim() || savingName}
                style={[styles.smallButton, !nameText.trim() && { opacity: 0.4 }]}
              >
                {savingName ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Save</Text>
                )}
              </PressableScale>
            </View>
            {nameError && <Text style={styles.error}>{nameError}</Text>}
          </View>
        ) : (
          <>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subtle}>{user?.email}</Text>
            <Pressable onPress={() => setEditing(true)} hitSlop={8} style={{ marginTop: 6 }}>
              <Text style={styles.link}>Edit name</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ---- Extras you can switch on ---- */}
      <Features />

      {/* ---- Notifications ---- */}
      <Section title="Notifications">
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <RowIcon name="notifications-outline" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Expiry reminders</Text>
              <Text style={styles.rowSub}>
                One reminder on days something needs using, for all your households.
              </Text>
            </View>
            <Toggle on={remindersOn} onPress={toggleReminders} disabled={blocked} />
          </View>

          {blocked && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Notifications are turned off for PantryGo in your phone's settings.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
                <Text style={styles.link}>Open phone settings</Text>
              </Pressable>
            </View>
          )}

          {remindersOn && (
            <>
              <Text style={styles.fieldLabel}>Remind me</Text>
              <View style={styles.bleed}>
                <FilterChips
                  options={WHEN_OPTIONS}
                  selected={String(reminders.prefs.daysBefore)}
                  onSelect={(v) => reminders.updatePrefs({ daysBefore: Number(v) as 0 | 1 | 2 })}
                />
              </View>
              <Text style={styles.fieldLabel}>At</Text>
              <View style={styles.bleed}>
                <FilterChips
                  options={TIME_OPTIONS}
                  selected={String(reminders.prefs.hour)}
                  onSelect={(v) => reminders.updatePrefs({ hour: Number(v) })}
                />
              </View>
              <Pressable
                onPress={() => {
                  tick();
                  reminders.sendTest();
                }}
                hitSlop={8}
                style={styles.testRow}
              >
                <Ionicons name="paper-plane-outline" size={16} color={colors.primary} />
                <Text style={styles.link}>Send a test reminder</Text>
              </Pressable>
            </>
          )}
        </View>
      </Section>

      {/* ---- Food & goals ---- */}
      <FoodAndGoals />

      {/* ---- Households ---- */}
      <Section title="Your households">
        <View style={styles.card}>
          {households.map((h, i) => {
            const current = h.id === household?.id;
            return (
              // Tap a household for its people, invite code and settings
              <Pressable
                key={h.id}
                onPress={() => router.push({ pathname: "/household/[id]", params: { id: h.id } })}
                style={[styles.settingRow, i > 0 && styles.divider]}
                accessibilityRole="button"
              >
                <View style={[styles.hhAvatar, current && styles.hhAvatarOn]}>
                  <Text style={[styles.hhAvatarText, current && styles.hhAvatarTextOn]}>
                    {h.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{h.name}</Text>
                  <Text style={styles.rowSub}>
                    {h.ownerId === user?.id ? "You're the owner" : "Member"}
                    {current ? " · showing now" : ""}
                  </Text>
                </View>
                {!current && (
                  <Pressable
                    onPress={() => {
                      tick();
                      switchHousehold(h.id);
                    }}
                    hitSlop={10}
                  >
                    <Text style={styles.link}>Switch</Text>
                  </Pressable>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push("/household-add")}
            style={[styles.settingRow, styles.divider]}
          >
            <RowIcon name="add-circle-outline" />
            <Text style={[styles.rowTitle, { color: colors.primary }]}>
              Join or create another household
            </Text>
          </Pressable>
        </View>
      </Section>

      {/* ---- Blocked people (only if you've blocked anyone) ---- */}
      <BlockedPeople />

      {/* ---- About ---- */}
      <Section title="About">
        <View style={styles.card}>
          <LinkRow icon="document-text-outline" label="Terms of use" doc="terms" first />
          <LinkRow icon="shield-checkmark-outline" label="Privacy policy" doc="privacy" />
          <LinkRow icon="code-slash-outline" label="Open-source licences" doc="licences" />
          {hasContactEmail() && (
            <Pressable
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=PantryGo`)}
              style={[styles.settingRow, styles.divider]}
              accessibilityRole="link"
            >
              <RowIcon name="mail-outline" />
              <Text style={[styles.rowTitle, { flex: 1 }]}>Contact us</Text>
              <Text style={styles.rowSub}>{CONTACT_EMAIL}</Text>
            </Pressable>
          )}
          <View style={[styles.settingRow, styles.divider]}>
            <RowIcon name="information-circle-outline" />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Version</Text>
            <Text style={styles.rowSub}>{version}</Text>
          </View>
        </View>
      </Section>

      {/* ---- Account ---- */}
      <Section title="Account">
        <View style={styles.card}>
          <Pressable onPress={signOut} style={styles.settingRow}>
            <RowIcon name="log-out-outline" />
            <Text style={[styles.rowTitle, { flex: 1 }]}>Sign out</Text>
          </Pressable>
          <Pressable onPress={deleteAccount} style={[styles.settingRow, styles.divider]}>
            <RowIcon name="trash-outline" danger />
            <Text style={[styles.rowTitle, styles.dangerText, { flex: 1 }]}>Delete account</Text>
          </Pressable>
          {deleteStep === 1 && (
            <View style={styles.deleteBox}>
              <Text style={styles.noticeText}>
                This permanently deletes your account, your calorie log and goals, and recipes
                you've shared. Things you added to households stay for the others.
                {ownedWithOthers.length > 0
                  ? " Households you own pass to the next person who joined, or are deleted if you're the only one in them."
                  : ""}
              </Text>
              <View style={styles.nameButtons}>
                <Pressable onPress={() => setDeleteStep(0)} hitSlop={8}>
                  <Text style={styles.linkSoft}>Keep my account</Text>
                </Pressable>
                <PressableScale
                  scaleTo={0.95}
                  onPress={deleteAccount}
                  disabled={deleting}
                  style={styles.deleteButton}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete for good</Text>
                  )}
                </PressableScale>
              </View>
              {deleteError && <Text style={styles.error}>{deleteError}</Text>}
            </View>
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

// ---- Small building blocks for this screen ----

function BlockedPeople() {
  const { blocked, unblock } = useCommunity();
  const [error, setError] = useState<string | null>(null);
  if (blocked.length === 0) return null;

  return (
    <Section title="Blocked people">
      <View style={styles.card}>
        {blocked.map((p, i) => (
          <View key={p.userId} style={[styles.settingRow, i > 0 && styles.divider]}>
            <RowIcon name="ban-outline" />
            <Text style={[styles.rowTitle, { flex: 1 }]}>{p.name}</Text>
            <Pressable
              onPress={async () => {
                tick();
                setError(await unblock(p.userId));
              }}
              hitSlop={10}
            >
              <Text style={styles.link}>Unblock</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>
        {error ?? "You don't see recipes these people share. They aren't told."}
      </Text>
    </Section>
  );
}

// Extras: off unless you switch them on, so the app stays simple
function Features() {
  const { prefs, savePrefs } = usePreferences();
  const { household, setSpendingEnabled } = useHousehold();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const isOwner = household?.ownerId === session?.user.id;
  const spendingOn = household?.spendingEnabled !== false;
  const [itemView, setItemView] = useState<ItemView>(readItemView);

  function toggleDark() {
    tick();
    saveThemeChoice(themeChoice === "dark" ? "light" : "dark");
    // Restart the JavaScript side so every screen is rebuilt with the new colours.
    // You stay signed in: your session is saved on the phone, not in memory.
    reloadAppAsync("Theme changed");
  }

  return (
    <Section title="Features">
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <RowIcon name="flame-outline" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Track calories</Text>
            <Text style={styles.rowSub}>
              A private food diary with daily goals. Only you see it.
            </Text>
          </View>
          <Toggle
            on={prefs.trackCalories}
            onPress={() => {
              tick();
              savePrefs({ trackCalories: !prefs.trackCalories });
            }}
          />
        </View>
        {household && (
          <View style={[styles.settingRow, styles.divider]}>
            <RowIcon name="wallet-outline" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Split costs</Text>
              <Text style={styles.rowSub}>
                {isOwner
                  ? `Track spending and who owes whom in ${household.name}.`
                  : `${spendingOn ? "On" : "Off"} for ${household.name}. Only the owner can change it.`}
              </Text>
            </View>
            <Toggle
              on={spendingOn}
              disabled={!isOwner}
              onPress={async () => {
                tick();
                setError(await setSpendingEnabled(household.id, !spendingOn));
              }}
            />
          </View>
        )}
        <View style={[styles.settingRow, styles.divider]}>
          <RowIcon name="flask-outline" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Container drawings</Text>
            <Text style={styles.rowSub}>
              Show a bottle or jar you drag on item pages, instead of a simple bar.
            </Text>
          </View>
          <Toggle
            on={itemView === "drawing"}
            onPress={() => {
              tick();
              const next = itemView === "drawing" ? "simple" : "drawing";
              setItemView(next);
              saveItemView(next);
            }}
          />
        </View>
        <View style={[styles.settingRow, styles.divider]}>
          <RowIcon name="moon-outline" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Dark mode</Text>
            <Text style={styles.rowSub}>The app restarts for a moment to switch.</Text>
          </View>
          <Toggle on={themeChoice === "dark"} onPress={toggleDark} />
        </View>
      </View>
      {error && <Text style={styles.hint}>{error}</Text>}
    </Section>
  );
}

function FoodAndGoals() {
  const { prefs } = usePreferences();
  const { goals } = useNutrition();

  const liked = prefs.cuisines.map(cuisineLabel).filter(Boolean) as string[];
  const eats = prefs.diet === "vegan" ? "Vegan" : prefs.diet === "vegetarian" ? "Vegetarian" : null;
  const foodSub =
    [
      liked.length > 2 ? `${liked.slice(0, 2).join(", ")} +${liked.length - 2}` : liked.join(", "),
      eats,
    ]
      .filter(Boolean)
      .join(" · ") || "Pick cuisines you like";

  return (
    <Section title={prefs.trackCalories ? "Food & goals" : "Food"}>
      <View style={styles.card}>
        <NavRow
          icon="restaurant-outline"
          label="Food preferences"
          sub={foodSub}
          href="/food-preferences"
          first
        />
        {prefs.trackCalories && (
          <>
            <NavRow
              icon="flame-outline"
              label="Calorie goals"
              sub={goals.kcal ? `${goals.kcal} kcal a day` : "No goal set"}
              href="/nutrition-goals"
            />
            <NavRow
              icon="calculator-outline"
              label="Suggest goals from my details"
              sub="Height, weight and activity. Not saved."
              href="/setup-goals"
            />
          </>
        )}
      </View>
    </Section>
  );
}

function NavRow({
  icon,
  label,
  sub,
  href,
  first = false,
}: {
  icon: IconName;
  label: string;
  sub: string;
  href: "/food-preferences" | "/nutrition-goals" | "/setup-goals";
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={[styles.settingRow, !first && styles.divider]}
      accessibilityRole="button"
    >
      <RowIcon name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function RowIcon({ name, danger = false }: { name: IconName; danger?: boolean }) {
  return (
    <View style={[styles.rowIcon, danger && { backgroundColor: colors.urgentBg }]}>
      <Ionicons name={name} size={18} color={danger ? colors.urgent : colors.primary} />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  doc,
  first = false,
}: {
  icon: IconName;
  label: string;
  doc: string;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc } })}
      style={[styles.settingRow, !first && styles.divider]}
      accessibilityRole="link"
    >
      <RowIcon name={icon} />
      <Text style={[styles.rowTitle, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
    </Pressable>
  );
}

function Toggle({
  on,
  onPress,
  disabled = false,
}: {
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={[styles.toggle, on && styles.toggleOn, disabled && { opacity: 0.4 }]}
    >
      <View style={[styles.knob, on && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },

  profileCard: { alignItems: "center", gap: 4, paddingTop: spacing.sm },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 32, color: colors.onPrimary },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  subtle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  nameEdit: { alignSelf: "stretch", gap: spacing.sm },
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
  },
  nameButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.lg,
  },

  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textSoft,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSoft },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  bleed: { marginHorizontal: -spacing.lg, marginBottom: spacing.xs },
  testRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.md },
  notice: {
    backgroundColor: colors.soonBg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  noticeText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  linkSoft: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent, textAlign: "center" },
  smallButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 72,
    alignItems: "center",
  },
  smallButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },

  hhAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  hhAvatarOn: { backgroundColor: colors.primary },
  hhAvatarText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  hhAvatarTextOn: { color: colors.onPrimary },

  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.border, padding: 3 },
  toggleOn: { backgroundColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 20 }] },

  dangerText: { color: colors.urgent },
  deleteBox: {
    backgroundColor: colors.urgentBg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  deleteButton: {
    backgroundColor: colors.urgent,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 120,
    alignItems: "center",
  },
  deleteButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
});

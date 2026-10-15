import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePantry } from "@/state/PantryContext";
import { useRecipes } from "@/state/RecipesContext";
import { useShopping } from "@/state/ShoppingContext";
import { colors, fonts, radius, spacing } from "@/theme";
import {
  isNewAccount,
  rememberDone,
  setGettingStartedMode,
  useGettingStarted,
  type StepId,
} from "@/utils/gettingStarted";
import { success, tick } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// "Getting started" on Home: the first few things to try, ticked off by doing them.
// Only for new accounts (or if turned back on in Profile), and closable with ✕.
// The four main steps finish it; inviting someone is a bonus.
// ---------------------------------------------------------------------------

type Step = { id: StepId; label: string; hint?: string; href: Href };

const MAIN: StepId[] = ["add", "use", "shop", "recipe"];

export function GettingStarted() {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const { events } = usePantry();
  const { list } = useShopping();
  const { recipes } = useRecipes();
  const { mode, done } = useGettingStarted();

  // What's true right now, from what's already in the app. Adding and using count
  // what YOU did, so joining a household that's already full still teaches you.
  const me = session?.user.id;
  const mine = events.filter((e) => e.userId === me);
  const now: StepId[] = [];
  if (mine.some((e) => e.type === "added")) now.push("add");
  if (mine.some((e) => e.type === "used" || e.type === "wasted")) now.push("use");
  if (list.length > 0) now.push("shop");
  if (recipes.length > 0) now.push("recipe");
  if (members.length > 1) now.push("invite");

  // Remember them, so a step stays ticked even after the list is emptied
  const key = now.join(",");
  useEffect(() => {
    if (now.length > 0) rememberDone(now);
  }, [key]); // `key` stands for the list, so it only runs when something new is done

  const isDone = (id: StepId) => done.includes(id) || now.includes(id);
  const mainDone = MAIN.filter(isDone).length;
  const allMain = mainDone === MAIN.length;

  const visible = mode === "shown" || (mode === "auto" && isNewAccount(session?.user.created_at));
  if (!visible || !household) return null;

  // Old accounts that already did everything never need to see it
  if (mode === "auto" && allMain && isDone("invite")) return null;

  const steps: Step[] = [
    {
      id: "add",
      label: "Add your first food",
      hint: "Scan a barcode or type it",
      href: "/add-item",
    },
    {
      id: "use",
      label: "Use or bin something",
      hint: "Tap an item in your pantry",
      href: "/pantry",
    },
    { id: "shop", label: "Add something to your shopping list", href: "/shopping" },
    {
      id: "recipe",
      label: "Save or make a recipe",
      hint: "Try one from Discover",
      href: "/recipes",
    },
    {
      id: "invite",
      label: "Invite someone to your household",
      hint: "Optional · share your household code",
      href: { pathname: "/household/[id]", params: { id: household.id } },
    },
  ];

  function close() {
    tick();
    setGettingStartedMode("hidden");
  }

  function finish() {
    success();
    setGettingStartedMode("hidden");
  }

  // ---- All four basics done: a small well-done, then it's gone ----
  if (allMain) {
    const invited = isDone("invite");
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.card, styles.doneCard]}>
        <View style={styles.doneHead}>
          <Text style={styles.party}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>You've got the basics</Text>
            <Text style={styles.sub}>That's everything PantryGo needs to start helping.</Text>
          </View>
        </View>
        {!invited && <StepRow step={steps[4]} done={false} icon="person-add-outline" />}
        <Pressable onPress={finish} style={styles.doneButton} accessibilityRole="button">
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
      style={styles.card}
    >
      <View style={styles.head}>
        <Text style={styles.title}>Getting started</Text>
        <Text style={styles.count}>
          {mainDone} of {MAIN.length}
        </Text>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide getting started"
        >
          <Ionicons name="close" size={20} color={colors.textSoft} />
        </Pressable>
      </View>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(mainDone / MAIN.length) * 100}%` }]} />
      </View>

      <View>
        {steps.map((s) => (
          <StepRow key={s.id} step={s} done={isDone(s.id)} />
        ))}
      </View>
    </Animated.View>
  );
}

function StepRow({
  step,
  done,
  icon,
}: {
  step: Step;
  done: boolean;
  icon?: "person-add-outline"; // instead of the empty circle (on the green card)
}) {
  return (
    <Pressable
      onPress={() => {
        if (done) return;
        tick();
        router.push(step.href);
      }}
      disabled={done}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityState={{ checked: done }}
    >
      <Ionicons
        name={icon ?? (done ? "checkmark-circle" : "ellipse-outline")}
        size={24}
        color={icon ? colors.primary : done ? colors.primaryBright : colors.border}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, done && styles.labelDone]}>{step.label}</Text>
        {!done && step.hint && <Text style={styles.hint}>{step.hint}</Text>}
      </View>
      {!done && <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  count: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.textSoft },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.card, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryBright },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  labelDone: { color: colors.textSoft, textDecorationLine: "line-through" },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, marginTop: 1 },
  doneCard: { backgroundColor: colors.primarySoft },
  doneHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  party: { fontSize: 30 },
  doneButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  doneButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { reloadAppAsync } from "expo";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { FoodStep } from "@/components/onboarding/FoodStep";
import { GoalsStep } from "@/components/onboarding/GoalsStep";
import { WelcomeSlides } from "@/components/onboarding/WelcomeSlides";
import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePreferences } from "@/state/PreferencesContext";
import { useReminders } from "@/state/RemindersContext";
import { colors, fonts, radius, saveThemeChoice, spacing, themeChoice, tints } from "@/theme";
import { success, tick } from "@/utils/haptics";
import { setFoodPictures, useFoodPictures } from "@/utils/foodPictures";
import { readItemView, saveItemView, type ItemView } from "@/utils/itemView";
import { myName } from "@/utils/me";

// The setup flow, shown once after you first join a household.
//   welcome slides → food you like → extras & look → calorie goals (optional) → reminders → done
// Every step can be skipped. Finishing (or "Skip setup") marks you as set up, so
// it never shows again; everything here can be changed later in Profile.

const STEPS = ["welcome", "food", "extras", "goals", "reminders", "done"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, { title: string; sub: string }> = {
  welcome: { title: "", sub: "" },
  food: {
    title: "What do you like to eat?",
    sub: "We'll put recipes you'll enjoy first.",
  },
  extras: {
    title: "Anything else?",
    sub: "PantryGo keeps it simple. Switch on what you want. You can change these later in Profile → Features.",
  },
  goals: {
    title: "Calorie goals",
    sub: "Want a daily target in the calorie tracker? We can suggest one. Totally optional.",
  },
  reminders: {
    title: "Use-by reminders",
    sub: "A nudge on your phone before food goes off, so less ends up in the bin.",
  },
  done: { title: "", sub: "" },
};

export default function OnboardingScreen() {
  const { session } = useAuth();
  const { household } = useHousehold();
  const { prefs, savePrefs, finishOnboarding } = usePreferences();
  const { setSpendingEnabled } = useHousehold();
  const spendingOn = household?.spendingEnabled !== false;
  const { turnOn, updatePrefs } = useReminders();

  const [step, setStep] = useState<Step>("welcome");
  const [goalsSet, setGoalsSet] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  // How things look. Drawings are saved straight away; dark mode is only applied
  // when you finish, because switching theme restarts the app (and this screen).
  const [itemView, setItemView] = useState<ItemView>(readItemView);
  const [dark, setDark] = useState(themeChoice === "dark");
  const foodPictures = useFoodPictures();

  // The calorie-goals step only shows if you've switched calories on
  const steps = STEPS.filter((s) => s !== "goals" || prefs.trackCalories);
  const index = steps.indexOf(step);
  const next = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const back = () => setStep(steps[Math.max(index - 1, 0)]);
  const middleCount = steps.length - 2; // without welcome and done

  const firstName = myName(session?.user).split(" ")[0];

  async function enableReminders() {
    const state = await turnOn();
    setRemindersOn(state === "granted");
    next();
  }

  function skipReminders() {
    updatePrefs({ asked: true }); // don't offer it again on Home
    next();
  }

  async function finish() {
    success();
    await finishOnboarding(); // the guard in _layout swaps this screen for the app
    const wanted = dark ? "dark" : "light";
    if (wanted !== themeChoice) {
      saveThemeChoice(wanted);
      reloadAppAsync("Theme changed"); // restart once so every screen picks up the new colours
    }
  }

  // The middle steps get a header with back, progress and "Skip setup"
  const middle = step !== "welcome" && step !== "done";

  // The start: four slides on what PantryGo does, full width (outside the scroller below)
  if (step === "welcome") {
    return (
      <SafeAreaView style={styles.safe}>
        <WelcomeSlides firstName={firstName} onStart={next} onSkipSetup={finish} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {middle && (
        <View style={styles.header}>
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </Pressable>
          <View style={styles.progress}>
            {Array.from({ length: middleCount }, (_, i) => i + 1).map((n) => (
              <View key={n} style={[styles.progressBit, n <= index && styles.progressOn]} />
            ))}
          </View>
          <Pressable onPress={finish} hitSlop={10}>
            <Text style={styles.skipAll}>Skip setup</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, !middle && styles.centred]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* key={step}: a new view each step, so it fades in fresh */}
        <Animated.View
          key={step}
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(120)}
          style={styles.stepWrap}
        >
          {middle && (
            <View style={styles.titles}>
              <Text style={styles.title}>{TITLES[step].title}</Text>
              <Text style={styles.sub}>{TITLES[step].sub}</Text>
            </View>
          )}

          {step === "food" && <FoodStep onDone={next} />}

          {step === "extras" && (
            <View style={styles.remindWrap}>
              <ExtraCard
                icon="flame-outline"
                title="Track calories"
                text="A private food diary with daily goals, and calories for what you cook. Only you see it."
                on={prefs.trackCalories}
                onToggle={() => savePrefs({ trackCalories: !prefs.trackCalories })}
              />
              {household && (
                <ExtraCard
                  icon="wallet-outline"
                  title="Split costs"
                  text={`Add what things cost and see who owes whom. Switches it on for everyone in ${household.name}.`}
                  on={spendingOn}
                  onToggle={() => setSpendingEnabled(household.id, !spendingOn)}
                />
              )}
              <Text style={styles.groupLabel}>Look</Text>
              <ExtraCard
                icon="image-outline"
                title="Food pictures"
                text="A little drawing next to each food, like a carrot or a carton of milk."
                on={foodPictures}
                onToggle={() => setFoodPictures(!foodPictures)}
              />
              <ExtraCard
                icon="cube-outline"
                title="Container drawings"
                text="On item pages, drag a drawing of the jar or bottle to show what's left. Off gives a simple bar."
                on={itemView === "drawing"}
                onToggle={() => {
                  const v = itemView === "drawing" ? "simple" : "drawing";
                  setItemView(v);
                  saveItemView(v);
                }}
              />
              <ExtraCard
                icon="moon-outline"
                title="Dark mode"
                text={
                  dark
                    ? "Switches on when you finish setup (the app restarts once)."
                    : "Darker colours, easier on the eyes at night."
                }
                on={dark}
                onToggle={() => setDark((d) => !d)}
              />
              <PressableScale scaleTo={0.97} onPress={next} style={styles.button}>
                <Text style={styles.buttonText}>Next</Text>
              </PressableScale>
            </View>
          )}

          {step === "goals" && (
            <GoalsStep
              onDone={() => {
                setGoalsSet(true);
                next();
              }}
              onSkip={next}
            />
          )}

          {step === "reminders" && (
            <View style={styles.remindWrap}>
              <View style={[styles.remindCard, { backgroundColor: tints.honey.bg }]}>
                <Ionicons name="notifications" size={28} color={tints.honey.icon} />
                <Text style={styles.remindText}>
                  "Milk is due tomorrow" — sent the morning before, at most once a day. Change the
                  timing any time in Profile.
                </Text>
              </View>
              <PressableScale scaleTo={0.97} onPress={enableReminders} style={styles.button}>
                <Text style={styles.buttonText}>Turn on reminders</Text>
              </PressableScale>
              <Pressable onPress={skipReminders} style={styles.textButton} hitSlop={8}>
                <Text style={styles.textButtonText}>Not now</Text>
              </Pressable>
            </View>
          )}

          {step === "done" && (
            <View style={styles.hero}>
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={40} color={colors.onPrimary} />
              </View>
              <Text style={styles.heroTitle}>You're all set</Text>
              <View style={styles.summary}>
                <SummaryLine on label="Recipe suggestions tuned to you" />
                {prefs.trackCalories && (
                  <SummaryLine
                    on={goalsSet}
                    label={
                      goalsSet ? "Calorie goals saved" : "No calorie goals (add some any time)"
                    }
                  />
                )}
                <SummaryLine
                  on={remindersOn}
                  label={remindersOn ? "Use-by reminders on" : "Reminders off"}
                />
              </View>
              <Text style={styles.heroSub}>You can change any of this in Profile.</Text>
              <PressableScale scaleTo={0.97} onPress={finish} style={styles.button}>
                <Text style={styles.buttonText}>Open my pantry</Text>
              </PressableScale>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExtraCard({
  icon,
  title,
  text,
  on,
  disabled = false,
  onToggle,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  text: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        tick();
        onToggle();
      }}
      style={[styles.extra, on && styles.extraOn, disabled && { opacity: 0.6 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
    >
      <Ionicons name={icon} size={24} color={on ? colors.primary : colors.textSoft} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.extraTitle}>{title}</Text>
        <Text style={styles.extraText}>{text}</Text>
      </View>
      <Ionicons
        name={on ? "checkmark-circle" : "ellipse-outline"}
        size={26}
        color={on ? colors.primary : colors.border}
      />
    </Pressable>
  );
}

function SummaryLine({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={styles.summaryLine}>
      <Ionicons
        name={on ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={on ? colors.primary : colors.textSoft}
      />
      <Text style={styles.summaryText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  progressBit: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  progressOn: { backgroundColor: colors.primary },
  skipAll: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  centred: { flexGrow: 1, justifyContent: "center" },
  stepWrap: { gap: spacing.lg },
  titles: { gap: spacing.xs },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.textSoft },
  hero: { alignItems: "stretch", gap: spacing.lg },
  artRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  heroTitle: { fontFamily: fonts.heading, fontSize: 32, color: colors.text, textAlign: "center" },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSoft,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  textButton: { alignSelf: "center", paddingVertical: spacing.sm },
  textButtonText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
  remindWrap: { gap: spacing.lg },
  groupLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.textSoft,
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
  },
  remindCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  remindText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  doneBadge: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  extra: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    padding: spacing.lg,
  },
  extraOn: { borderColor: colors.primary },
  extraTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  extraText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  summaryLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
});

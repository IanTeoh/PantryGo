import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { FoodArt } from "@/components/FoodIcon";
import { FoodStep } from "@/components/onboarding/FoodStep";
import { GoalsStep } from "@/components/onboarding/GoalsStep";
import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePreferences } from "@/state/PreferencesContext";
import { useReminders } from "@/state/RemindersContext";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import { success } from "@/utils/haptics";

// The setup flow, shown once after you first join a household.
//   welcome → food you like → calorie goals (optional) → reminders → done
// Every step can be skipped. Finishing (or "Skip setup") marks you as set up, so
// it never shows again; everything here can be changed later in Profile.

const STEPS = ["welcome", "food", "goals", "reminders", "done"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, { title: string; sub: string }> = {
  welcome: { title: "", sub: "" },
  food: {
    title: "What do you like to eat?",
    sub: "We'll put recipes you'll enjoy first.",
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
  const { finishOnboarding } = usePreferences();
  const { turnOn, updatePrefs } = useReminders();

  const [step, setStep] = useState<Step>("welcome");
  const [goalsSet, setGoalsSet] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)]);

  const firstName =
    (session?.user.user_metadata?.display_name as string | undefined)?.split(" ")[0] ?? "";

  async function enableReminders() {
    const state = await turnOn();
    setRemindersOn(state === "granted");
    next();
  }

  function skipReminders() {
    updatePrefs({ asked: true }); // don't offer it again on Home
    next();
  }

  function finish() {
    success();
    finishOnboarding(); // the guard in _layout swaps this screen for the app
  }

  // The middle steps get a header with back, progress and "Skip setup"
  const middle = step !== "welcome" && step !== "done";

  return (
    <SafeAreaView style={styles.safe}>
      {middle && (
        <View style={styles.header}>
          <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </Pressable>
          <View style={styles.progress}>
            {[1, 2, 3].map((n) => (
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

          {step === "welcome" && (
            <View style={styles.hero}>
              <View style={styles.artRow}>
                <FoodArt art="carrot" size={52} />
                <FoodArt art="cheese-wedge" size={52} />
                <FoodArt art="bread" size={52} />
              </View>
              <Text style={styles.heroTitle}>
                {firstName ? `Welcome, ${firstName}!` : "Welcome to PantryGo!"}
              </Text>
              <Text style={styles.heroSub}>
                {household ? `You're in ${household.name}. ` : ""}A few quick questions to set
                things up for you. It takes about a minute, and you can skip anything.
              </Text>
              <PressableScale scaleTo={0.97} onPress={next} style={styles.button}>
                <Text style={styles.buttonText}>Let's go</Text>
              </PressableScale>
              <Pressable onPress={finish} style={styles.textButton} hitSlop={8}>
                <Text style={styles.textButtonText}>Skip, I'll set up later</Text>
              </Pressable>
            </View>
          )}

          {step === "food" && <FoodStep onDone={next} />}

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
                <SummaryLine
                  on={goalsSet}
                  label={goalsSet ? "Calorie goals saved" : "No calorie goals (add some any time)"}
                />
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
  summaryLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
});

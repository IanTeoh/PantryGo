import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";
import Animated from "react-native-reanimated";

import { FilterChips } from "@/components/FilterChips";
import { PressableScale } from "@/components/PressableScale";
import { useNutrition, type Goals } from "@/state/NutritionContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success, tick } from "@/utils/haptics";
import {
  ACTIVITY_OPTIONS,
  suggestGoals,
  type Activity,
  type Aim,
  type GoalSuggestion,
  type Sex,
} from "@/utils/goals";
import { rowEntering } from "@/utils/motion";

const SEXES: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unspecified", label: "Prefer not to say" },
];

const AIMS: { value: Aim; label: string }[] = [
  { value: "lose", label: "Lose a little" },
  { value: "maintain", label: "Keep steady" },
  { value: "gain", label: "Gain" },
];

const num = (t: string) => Number(t.trim().replace(",", "."));

// "Suggest calorie goals from my details." Used in the setup flow and from Profile.
// Your age, height and weight stay in this screen's memory only: they're never
// saved anywhere. Only the goals you choose to keep are saved.
export function GoalsStep({
  onDone,
  onSkip,
  skipLabel = "Skip for now",
}: {
  onDone: () => void;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const { saveGoals } = useNutrition();

  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<Activity>("light");
  const [aim, setAim] = useState<Aim>("maintain");

  const [result, setResult] = useState<GoalSuggestion | null>(null);
  // The suggested numbers as editable text
  const [edit, setEdit] = useState({ kcal: "", protein: "", carbs: "", fat: "" });

  const filledIn = age.trim() !== "" && height.trim() !== "" && weight.trim() !== "";

  function workItOut() {
    tick();
    const r = suggestGoals({
      age: num(age),
      sex,
      heightCm: num(height),
      weightKg: num(weight),
      activity,
      aim,
    });
    setResult(r);
    if (r.ok) {
      setEdit({
        kcal: String(r.kcal),
        protein: String(r.protein),
        carbs: String(r.carbs),
        fat: String(r.fat),
      });
    }
  }

  // Any change to the details hides the old answer, so it's never out of date
  function changed<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setResult(null);
    };
  }

  const parse = (t: string) => {
    const n = Math.round(num(t));
    return t.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
  };
  const goals: Goals = {
    kcal: parse(edit.kcal),
    protein: parse(edit.protein),
    carbs: parse(edit.carbs),
    fat: parse(edit.fat),
  };
  const canSave = goals.kcal !== null && goals.kcal < 20000;

  function save() {
    if (!canSave) return;
    success();
    saveGoals(goals);
    onDone();
  }

  function numberBox(value: string, set: (t: string) => void, placeholder: string, unit: string) {
    return (
      <View style={styles.boxWrap}>
        <TextInput
          value={value}
          onChangeText={changed(set)}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={styles.box}
          maxLength={5}
        />
        <Text style={styles.boxUnit}>{unit}</Text>
      </View>
    );
  }

  function goalRow(key: keyof typeof edit, label: string, unit: string) {
    return (
      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>{label}</Text>
        <TextInput
          value={edit[key]}
          onChangeText={(t) => setEdit({ ...edit, [key]: t })}
          keyboardType="number-pad"
          style={styles.goalInput}
          selectTextOnFocus
        />
        <Text style={styles.goalUnit}>{unit}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.privacy}>
        <Ionicons name="lock-closed" size={14} color={colors.primary} />
        <Text style={styles.privacyText}>
          Your details are only used to work out a suggestion. They aren't saved.
        </Text>
      </View>

      <View style={styles.boxes}>
        <View style={styles.boxCol}>
          <Text style={styles.label}>Age</Text>
          {numberBox(age, setAge, "21", "yrs")}
        </View>
        <View style={styles.boxCol}>
          <Text style={styles.label}>Height</Text>
          {numberBox(height, setHeight, "170", "cm")}
        </View>
        <View style={styles.boxCol}>
          <Text style={styles.label}>Weight</Text>
          {numberBox(weight, setWeight, "65", "kg")}
        </View>
      </View>

      <Text style={styles.label}>Sex</Text>
      <View style={styles.bleed}>
        <FilterChips options={SEXES} selected={sex} onSelect={changed(setSex)} />
      </View>
      <Text style={styles.hint}>
        Only used for the estimate (bodies use energy a bit differently). "Prefer not to say" uses
        an in-between value.
      </Text>

      <Text style={styles.label}>How active are you?</Text>
      <View style={styles.options}>
        {ACTIVITY_OPTIONS.map((o) => {
          const on = activity === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => changed(setActivity)(o.value)}
              style={[styles.option, on && styles.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Ionicons
                name={on ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={on ? colors.primary : colors.textSoft}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{o.label}</Text>
                <Text style={styles.optionHint}>{o.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>What are you aiming for?</Text>
      <View style={styles.bleed}>
        <FilterChips options={AIMS} selected={aim} onSelect={changed(setAim)} />
      </View>

      {result === null ? (
        <PressableScale
          scaleTo={0.97}
          onPress={workItOut}
          disabled={!filledIn}
          style={[styles.button, !filledIn && { opacity: 0.4 }]}
        >
          <Text style={styles.buttonText}>Work it out</Text>
        </PressableScale>
      ) : !result.ok ? (
        <Animated.View entering={rowEntering(0)} style={styles.warn}>
          <Ionicons name="information-circle" size={20} color={colors.urgent} />
          <Text style={styles.warnText}>{result.reason}</Text>
        </Animated.View>
      ) : (
        <Animated.View entering={rowEntering(0)} style={styles.resultWrap}>
          <Text style={styles.resultTitle}>A starting point for you</Text>
          <View style={styles.card}>
            {goalRow("kcal", "Calories", "kcal")}
            <View style={styles.divider} />
            {goalRow("protein", "Protein", "g")}
            <View style={styles.divider} />
            {goalRow("carbs", "Carbs", "g")}
            <View style={styles.divider} />
            {goalRow("fat", "Fat", "g")}
          </View>
          {result.notes.map((n, i) => (
            <Text key={i} style={styles.hint}>
              {n}
            </Text>
          ))}
          <Text style={styles.hint}>Tap a number to change it.</Text>
          <PressableScale
            scaleTo={0.97}
            onPress={save}
            disabled={!canSave}
            style={[styles.button, !canSave && { opacity: 0.4 }]}
          >
            <Text style={styles.buttonText}>Save these goals</Text>
          </PressableScale>
        </Animated.View>
      )}

      <Pressable onPress={onSkip} style={styles.skip} hitSlop={8}>
        <Text style={styles.skipText}>{skipLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacyText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary },
  boxes: { flexDirection: "row", gap: spacing.sm },
  boxCol: { flex: 1, gap: 6 },
  boxWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  box: {
    flex: 1,
    paddingVertical: spacing.md,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.text,
  },
  boxUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  bleed: { marginHorizontal: -spacing.lg },
  options: { gap: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    padding: spacing.md,
  },
  optionOn: { borderColor: colors.primary },
  optionTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  optionHint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  warn: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.urgentBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  warnText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  resultWrap: { gap: spacing.md, marginTop: spacing.sm },
  resultTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  goalLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  goalInput: {
    width: 90,
    textAlign: "right",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  goalUnit: { width: 32, fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  divider: { height: 1, backgroundColor: colors.border },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  skip: { alignSelf: "center", paddingVertical: spacing.sm },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
});

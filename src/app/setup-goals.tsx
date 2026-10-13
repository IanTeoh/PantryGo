import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { GoalsStep } from "@/components/onboarding/GoalsStep";
import { colors, fonts, spacing } from "@/theme";

// Profile → "Suggest goals from my details". Saving replaces your current goals.
export default function SetupGoalsScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.intro}>
        Answer a few questions and we'll suggest daily calorie and macro goals. Saving replaces the
        goals you have now.
      </Text>
      <GoalsStep onDone={() => router.back()} onSkip={() => router.back()} skipLabel="Cancel" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
});

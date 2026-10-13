import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { FoodStep } from "@/components/onboarding/FoodStep";
import { colors, fonts, spacing } from "@/theme";

// Profile → Food preferences. The same picker as the setup flow.
export default function FoodPreferencesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Recipes in these cuisines show up first on Home and in Discover. Only you can see this.
      </Text>
      <FoodStep doneLabel="Save" onDone={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
});

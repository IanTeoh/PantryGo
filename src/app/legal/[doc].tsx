import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { LEGAL_DOCS } from "@/data/legal";
import { colors, fonts, radius, spacing } from "@/theme";

// /legal/terms, /legal/privacy, /legal/licences
//
// The text lives in src/data/legal.ts (shared with the public web pages).

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const page = LEGAL_DOCS[doc ?? ""] ?? LEGAL_DOCS.terms;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: page.title }} />
      <Text style={styles.updated}>Last updated {page.updated}</Text>
      {page.sections.map((s) => (
        <View key={s.heading} style={styles.card}>
          <Text style={styles.heading}>{s.heading}</Text>
          {s.body.map((para, i) => (
            <Text key={i} style={styles.body}>
              {para}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  updated: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
});

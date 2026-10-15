import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TextInput } from "@/components/TextInput";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing } from "@/theme";

// Create a household or join one with a code. Two screens use this form:
//   app/household-setup.tsx: after signing in, until you're in any household
//   app/household-add.tsx:   "Join or create another" (adding = true), as a modal
export function HouseholdForm({ adding = false }: { adding?: boolean }) {
  const { session, signOut } = useAuth();
  const { household, createHousehold, joinHousehold } = useHousehold();

  const firstName = ((session?.user.user_metadata?.display_name as string) || "").split(" ")[0];

  const [name, setName] = useState(adding ? "" : firstName ? `${firstName}'s kitchen` : "");
  const [code, setCode] = useState("");
  // Which button is waiting for the server, so only that one shows a spinner
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Codes are 8 letters and digits ("TA4TQSBF"); spaces and dashes are ignored
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function create() {
    if (!name.trim() || busy) return;
    setBusy("create");
    setError(null);
    const message = await createHousehold(name);
    // If it worked: first time, the root layout sees you now have a household and shows
    // the tabs. Adding another: close this form (you're switched to the new one).
    setBusy(null);
    if (message) setError(message);
    else if (adding) router.back();
  }

  async function join() {
    if (cleanCode.length !== 8 || busy) return;
    setBusy("join");
    setError(null);
    const message = await joinHousehold(cleanCode);
    setBusy(null);
    if (message) setError(message);
    else if (adding) router.back();
  }

  return (
    // As a modal, the header already keeps clear of the notch, so only pad the bottom
    <SafeAreaView style={styles.safe} edges={adding ? ["bottom"] : undefined}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, adding && styles.contentTop]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.heading}>
              {adding
                ? "Add a household"
                : firstName
                  ? `Welcome, ${firstName}`
                  : "Welcome to PantryGo"}
            </Text>
            <Text style={styles.subtle}>
              {adding
                ? `You'll stay in ${household?.name ?? "your other households"} too. Switch between them by tapping the household name on Home.`
                : "A household is a shared pantry. Make one for yourself, or join your flat's or family's with their code."}
            </Text>
          </View>

          {/* ---- Create ---- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Start a new household</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Flat 4B"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              autoCapitalize="words"
            />
            <PrimaryButton
              label="Create household"
              onPress={create}
              disabled={!name.trim() || busy !== null}
              loading={busy === "create"}
            />
          </View>

          <Text style={styles.or}>or</Text>

          {/* ---- Join ---- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join with an invite code</Text>
            <Text style={styles.subtle}>
              Ask someone in the household: it's on the household's page in the app.
            </Text>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="ABCD2345"
              placeholderTextColor={colors.textSoft}
              style={[styles.input, styles.codeInput]}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9} // 8, plus room for a dash if someone types one
            />
            <PrimaryButton
              label="Join household"
              onPress={join}
              disabled={cleanCode.length !== 8 || busy !== null}
              loading={busy === "join"}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {!adding && (
            <Pressable onPress={signOut} style={styles.signOut}>
              <Text style={styles.signOutText}>
                Signed in as {session?.user.email} · <Text style={styles.link}>Sign out</Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && !loading && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  contentTop: { justifyContent: "flex-start" },
  intro: { gap: spacing.sm, marginBottom: spacing.sm },
  heading: { fontFamily: fonts.heading, fontSize: 30, color: colors.text },
  subtle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    letterSpacing: 4, // spaced-out letters, easier to read a code
    textAlign: "center",
  },
  or: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, textAlign: "center" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.urgent, textAlign: "center" },
  signOut: { alignItems: "center", padding: spacing.md },
  signOutText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  link: { fontFamily: fonts.bodyBold, color: colors.primary },
});

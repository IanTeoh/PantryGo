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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/state/AuthContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success } from "@/utils/haptics";

// Shown when the app is opened from a password-reset email (see AuthContext).
// The emailed code (or link) has already signed you in; this sets the new password.
export function SetNewPassword() {
  const { setNewPassword, cancelRecovery, session } = useAuth();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= 6;
  const matches = password === again;
  const ready = session !== null; // the code's sign-in has landed
  const canSave = longEnough && matches && ready && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const message = await setNewPassword(password);
    setBusy(false);
    if (message) {
      setError(
        message.toLowerCase().includes("different")
          ? "Choose a password you haven't used for this account before."
          : message,
      );
    } else {
      success(); // the app opens, signed in with the new password
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Choose a new password</Text>
            {session?.user.email && <Text style={styles.help}>For {session.user.email}</Text>}

            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                autoFocus
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Type it again</Text>
              <TextInput
                value={again}
                onChangeText={setAgain}
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                onSubmitEditing={save}
                returnKeyType="go"
              />
            </View>
            {again.length > 0 && !matches && (
              <Text style={styles.error}>Those don't match yet.</Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={save}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.button,
                !canSave && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
            >
              {busy || !ready ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Save new password</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={cancelRecovery} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  help: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
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
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.urgent },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  cancel: { alignSelf: "center", padding: spacing.sm },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.textSoft },
});

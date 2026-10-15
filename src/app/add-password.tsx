import { Stack, router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { TextInput } from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success } from "@/utils/haptics";
import { hasPassword, isHiddenAppleEmail } from "@/utils/me";

// ---------------------------------------------------------------------------
// Email and password for an account made with Apple or Google, so you can also
// sign in the normal way (e.g. on a phone without your Apple ID). It's the same
// account, not a new one. Opened from Profile → Sign-in methods.
//
// Google accounts already have a real email: you just choose a password.
// Apple accounts with "Hide my email" have a made-up relay address, so you type
// your real email and confirm it with a 6-digit code first.
// If you already have a password, this changes it.
// ---------------------------------------------------------------------------

export default function AddPasswordScreen() {
  const { session } = useAuth();
  const user = session?.user;
  const current = user?.email ?? "";
  const changing = hasPassword(user); // already has one: just pick a new one

  const [email, setEmail] = useState(isHiddenAppleEmail(current) ? "" : current);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const newEmail = !changing && cleanEmail !== current.toLowerCase();
  const emailOk = /^\S+@\S+\.\S+$/.test(cleanEmail) && !isHiddenAppleEmail(cleanEmail);
  const passwordOk = password.length >= 6; // Supabase's minimum
  const canSubmit =
    !busy && (step === "code" ? code.length >= 6 : passwordOk && (changing || emailOk));

  async function savePassword() {
    const { error } = await supabase.auth.updateUser({
      password,
      data: { has_password: true }, // so Profile knows (Supabase doesn't say for Apple/Google accounts)
    });
    if (error) return setError(error.message);
    success();
    router.back();
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      if (step === "code") {
        // The code proves the new email is yours; then the password goes on
        const { error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: code,
          type: "email_change",
        });
        if (error) return setError("That code didn't work. Check it, or ask for a new one.");
        return await savePassword();
      }
      if (newEmail) {
        // Email first: Supabase sends a code to the new address
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) {
          return setError(
            /already|registered|exists/i.test(error.message)
              ? "That email already has its own PantryGo account. Use a different email, or sign in with that one instead."
              : error.message,
          );
        }
        setStep("code");
        return;
      }
      await savePassword();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: changing ? "Change password" : "Email and password" }} />

      <Text style={styles.intro}>
        {changing
          ? "Choose a new password for signing in with your email."
          : "Add an email and password so you can also sign in the normal way. It's the same account, with all your households and recipes."}
      </Text>

      {step === "form" ? (
        <>
          {!changing && (
            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              {isHiddenAppleEmail(current) && (
                <Text style={styles.hint}>
                  You signed in with Apple's "Hide my email", so type the email you'd like to use.
                  We'll send it a code.
                </Text>
              )}
            </Field>
          )}
          <Field label={changing ? "New password" : "Password"}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={submit}
            />
          </Field>
        </>
      ) : (
        <Field label={`Code sent to ${cleanEmail}`}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^\d]/g, ""))}
            placeholder="123456"
            placeholderTextColor={colors.textSoft}
            style={[styles.input, styles.codeInput]}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={10}
            autoFocus
            onSubmitEditing={submit}
          />
          <Text style={styles.hint}>
            It can take a minute or two to arrive, so check your spam folder too.
          </Text>
          <Pressable
            onPress={() => {
              setStep("form");
              setCode("");
            }}
            hitSlop={8}
          >
            <Text style={styles.link}>Use a different email</Text>
          </Pressable>
        </Field>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.button,
          !canSubmit && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>
            {step === "code" ? "Confirm" : newEmail ? "Send code" : "Save password"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  intro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSoft },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
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
  codeInput: { fontFamily: fonts.bodyBold, fontSize: 22, letterSpacing: 4 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSoft },
  link: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.urgent },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

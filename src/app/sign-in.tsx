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

import { Logo } from "@/components/Logo";
import { SocialSignIn } from "@/components/SocialSignIn";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/state/AuthContext";
import { colors, fonts, radius, spacing } from "@/theme";

type Mode = "signIn" | "signUp" | "forgot" | "confirm"; // confirm = typing the sign-up code

export default function SignInScreen() {
  const {
    signIn,
    signUp,
    confirmSignUp,
    resendSignUpCode,
    sendPasswordReset,
    verifyResetCode,
    linkError,
    clearLinkError,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); // waiting for Supabase to answer
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false); // "Check your email"
  const [code, setCode] = useState(""); // the code from that email
  const [notice, setNotice] = useState<string | null>(null); // e.g. "We've sent a new code"

  const isSignUp = mode === "signUp";
  const isForgot = mode === "forgot";
  const isConfirm = mode === "confirm";

  // Simple checks before we even ask Supabase
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim()); // something@something.something
  const passwordOk = password.length >= 6; // Supabase's minimum
  const nameOk = !isSignUp || name.trim().length > 0;
  const codeOk = /^\d{6,10}$/.test(code.replace(/\s/g, "")); // Supabase sends 6 digits by default
  const enteringCode = isForgot && resetSent;
  const showCode = enteringCode || isConfirm;
  const canSubmit = emailOk && (showCode ? codeOk : isForgot || passwordOk) && nameOk && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    clearLinkError();

    // Confirming a new account: right code → signed in → the app opens by itself
    if (isConfirm) {
      const message = await confirmSignUp(email, code);
      setBusy(false);
      if (message) setError(friendlyError(message));
      return;
    }

    // The code worked → the root layout shows "Choose a new password" by itself
    if (enteringCode) {
      const message = await verifyResetCode(email, code);
      setBusy(false);
      if (message) setError(friendlyError(message));
      return;
    }

    if (isForgot) {
      const message = await sendPasswordReset(email);
      setBusy(false);
      if (message) setError(friendlyError(message));
      else {
        setResetSent(true);
        setCode("");
      }
      return;
    }

    // Wait for Supabase. If it works, the AuthProvider hears about the new session
    // and the root layout swaps this screen for the tabs. We don't navigate ourselves.
    if (isSignUp) {
      const result = await signUp(name, email, password);
      setBusy(false);
      if (result.error) setError(friendlyError(result.error));
      else if (result.needsCode) startConfirm(null);
      return;
    }

    const message = await signIn(email, password);
    setBusy(false);
    if (message?.toLowerCase().includes("email not confirmed")) {
      // Signed up earlier but never typed the code: send a fresh one and ask for it
      const resent = await resendSignUpCode(email);
      startConfirm(resent ? null : "Your email isn't confirmed yet, so we've sent you a new code.");
      return;
    }
    if (message) setError(friendlyError(message));
  }

  function startConfirm(note: string | null) {
    setMode("confirm");
    setCode("");
    setError(null);
    setNotice(note);
  }

  async function resendCode() {
    setError(null);
    const message = await resendSignUpCode(email);
    if (message) setError(friendlyError(message));
    else setNotice("We've sent a new code. Use the newest email.");
  }

  function switchMode() {
    // From "confirm" (wrong email): back to making the account. From "forgot": back to sign in.
    setMode(mode === "signIn" || mode === "confirm" ? "signUp" : "signIn");
    setError(null);
    setNotice(null);
    setResetSent(false);
    clearLinkError();
  }

  function forgot() {
    setMode("forgot");
    setError(null);
    setResetSent(false);
    clearLinkError();
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Pushes the form up when the keyboard opens, so fields aren't hidden */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            {/* The logo, then the lettering with a leaf that grows out of the "t" */}
            <Logo height={92} />
            <Wordmark size={44} grow />
            <Text style={styles.tagline}>Know what's in your kitchen. Waste less.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>
              {isConfirm
                ? "Confirm your email"
                : isForgot
                  ? "Reset your password"
                  : isSignUp
                    ? "Create your account"
                    : "Welcome back"}
            </Text>
            {isForgot && !resetSent && (
              <Text style={styles.help}>
                Enter the email you signed up with. We'll send you a code to choose a new password.
              </Text>
            )}

            {isConfirm && (
              <Text style={styles.help}>
                We've sent a code to <Text style={styles.strong}>{email.trim()}</Text>. Type it
                below to finish making your account. Check your spam folder if it's not there in a
                minute. Already have an account with this email? Sign in instead.
              </Text>
            )}

            {isSignUp && (
              <Field label="Your name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Sam"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  autoCapitalize="words"
                  textContentType="givenName"
                />
              </Field>
            )}

            {!isConfirm && (
              <Field label="Email">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </Field>
            )}

            {!isForgot && !isConfirm && (
              <Field label="Password">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textSoft}
                  style={styles.input}
                  secureTextEntry // shows dots instead of the letters
                  textContentType={isSignUp ? "newPassword" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
              </Field>
            )}

            {!isSignUp && !isForgot && (
              <Pressable onPress={forgot} hitSlop={8} style={styles.forgot}>
                <Text style={styles.switchLink}>Forgot password?</Text>
              </Pressable>
            )}

            {resetSent && (
              <View style={styles.sent}>
                <Text style={styles.sentTitle}>Check your email</Text>
                <Text style={styles.help}>
                  If there's an account for {email.trim()}, a code is on its way. It can take a
                  minute or two, so check your spam folder too.
                </Text>
              </View>
            )}

            {showCode && (
              <Field label="Code from the email">
                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/[^\d]/g, ""))}
                  placeholder="123456"
                  placeholderTextColor={colors.textSoft}
                  style={[styles.input, styles.codeInput]}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode" // iPhone offers the code from Mail above the keyboard
                  autoComplete="one-time-code"
                  maxLength={10}
                  onSubmitEditing={submit}
                />
              </Field>
            )}

            {notice && !error && <Text style={styles.notice}>{notice}</Text>}
            {(error || linkError) && <Text style={styles.error}>{error ?? linkError}</Text>}

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
                <ActivityIndicator color={colors.onPrimary} /> // a spinning wheel while we wait
              ) : (
                <Text style={styles.buttonText}>
                  {isConfirm
                    ? "Confirm"
                    : isForgot
                      ? resetSent
                        ? "Continue"
                        : "Send code"
                      : isSignUp
                        ? "Create account"
                        : "Sign in"}
                </Text>
              )}
            </Pressable>

            {isConfirm && (
              <Pressable onPress={resendCode} hitSlop={8} style={styles.resend}>
                <Text style={styles.switchLink}>Didn't get it? Send a new code</Text>
              </Pressable>
            )}

            {enteringCode && (
              <Pressable
                onPress={() => {
                  setResetSent(false);
                  setCode("");
                  setError(null);
                }}
                hitSlop={8}
                style={styles.resend}
              >
                <Text style={styles.switchLink}>Didn't get it? Send a new code</Text>
              </Pressable>
            )}

            {/* Apple and Google: only on the main sign-in and sign-up screens */}
            {(mode === "signIn" || mode === "signUp") && <SocialSignIn onError={setError} />}
          </View>

          <Pressable onPress={switchMode} style={styles.switch}>
            <Text style={styles.switchText}>
              {isConfirm
                ? "Wrong email? "
                : isForgot
                  ? "Remembered it? "
                  : isSignUp
                    ? "Already have an account? "
                    : "New to PantryGo? "}
              <Text style={styles.switchLink}>
                {isConfirm
                  ? "Start again"
                  : isForgot
                    ? "Back to sign in"
                    : isSignUp
                      ? "Sign in"
                      : "Create an account"}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// A label above an input. `children` = whatever is placed between <Field> and </Field>.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// Supabase's error messages are written for developers; reword the common ones.
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match an account.";
  if (m.includes("already registered"))
    return "There's already an account with that email. Try signing in.";
  if (m.includes("email not confirmed")) return "Check your inbox and confirm your email first.";
  if (m.includes("network")) return "Couldn't reach the server. Check your internet connection.";
  if (m.includes("token has expired") || m.includes("otp") || m.includes("invalid token"))
    return "That code is wrong or has expired. Check the newest email, or send a new code.";
  if (m.includes("rate limit") || m.includes("security purposes"))
    return "Too many emails sent just now. Wait a few minutes, then try again.";
  return message;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg },
  brand: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.md },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.textSoft },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
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
  codeInput: { fontFamily: fonts.bodyBold, fontSize: 22, letterSpacing: 4 },
  resend: { alignSelf: "center" },
  notice: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.primary },
  strong: { fontFamily: fonts.bodySemi, color: colors.text },
  help: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSoft },
  forgot: { alignSelf: "flex-end", marginTop: -spacing.xs },
  sent: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sentTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  switch: { alignItems: "center", padding: spacing.sm },
  switchText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft },
  switchLink: { fontFamily: fonts.bodyBold, color: colors.primary },
});

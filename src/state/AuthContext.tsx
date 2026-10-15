import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

// Same pattern as PantryContext: a Provider that owns the state, and a hook to read it.
type AuthContextValue = {
  session: Session | null; // null = signed out
  loading: boolean; // true until we've checked whether you're already signed in
  signIn: (email: string, password: string) => Promise<string | null>; // returns an error message, or null if it worked
  // needsCode: the account was made, but the email needs confirming with the emailed code first
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsCode: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<string | null>;
  resendSignUpCode: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Sign in (or sign up) with Apple or Google. Returns an error message, or null
  // if it worked or the person cancelled.
  signInWithApple: () => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  // Your profile picture: a path in the avatars bucket, or null to remove it
  setMyAvatar: (path: string | null) => Promise<string | null>;
  // Linking: add Apple or Google to the account you're signed in to, so any of them
  // opens the same PantryGo account. Each returns an error message, or null.
  linkApple: () => Promise<string | null>;
  linkGoogle: () => Promise<string | null>;
  unlinkProvider: (provider: SocialProvider) => Promise<string | null>;
  // Forgot password: emails a code (and a link). Typing the code signs you in just
  // long enough to choose a new password.
  sendPasswordReset: (email: string) => Promise<string | null>;
  verifyResetCode: (email: string, code: string) => Promise<string | null>;
  recovering: boolean; // code (or link) worked: show "Choose a new password"
  setNewPassword: (password: string) => Promise<string | null>;
  cancelRecovery: () => Promise<void>;
  linkError: string | null; // the link was old or already used
  clearLinkError: () => void;
};

export type SocialProvider = "apple" | "google";
const PROVIDER_NAME: Record<SocialProvider, string> = {
  apple: "Apple ID",
  google: "Google account",
};

// Supabase's linking errors, in plain words
function linkErrorMessage(message: string, provider: SocialProvider): string {
  const m = message.toLowerCase();
  if (m.includes("manual linking"))
    return 'Linking isn\'t switched on yet. In Supabase: Authentication → Sign In / Providers → turn on "Allow manual linking".';
  if (m.includes("already") || m.includes("exists"))
    return `That ${PROVIDER_NAME[provider]} already has its own PantryGo account. To link it here, sign in with it, delete that account (Profile → Delete account), then sign back in here and try again.`;
  return message;
}

// Where the reset email's link sends people: back into this app. In Expo Go it's
// exp://…/--/?reset=1, in a real build pantrygo://?reset=1. Both must be allowed in
// Supabase → Authentication → URL Configuration → Redirect URLs.
const RESET_REDIRECT = Linking.createURL("/", { queryParams: { reset: "1" } });

// "pantrygo://?reset=1#access_token=…&type=recovery" → { reset: "1", access_token: …, type: … }
function linkParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = url.split(/[?#]/).slice(1); // the bits after ? and #
  for (const part of parts) {
    for (const pair of part.split("&")) {
      const [k, v = ""] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    }
  }
  return out;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // ---- Opened from a password-reset email ----
  const url = Linking.useLinkingURL();
  const handled = useRef(new Set<string>()); // each link only once
  useEffect(() => {
    if (!url || handled.current.has(url)) return;
    const p = linkParams(url);
    const isReset = p.reset === "1" || p.type === "recovery";
    if (!isReset) return;
    handled.current.add(url);

    (async () => {
      if (p.error || p.error_code) {
        setLinkError(
          p.error_code === "otp_expired"
            ? "That reset link has expired or was already used. Ask for a new one."
            : p.error_description || "That reset link didn't work. Ask for a new one.",
        );
        return;
      }
      // The link carries a one-time sign-in, either as tokens or as a code.
      // Show the new-password screen first, so the app doesn't flash past it.
      if (!p.access_token && !p.code) return;
      setRecovering(true);
      const result = p.access_token
        ? await supabase.auth.setSession({
            access_token: p.access_token,
            refresh_token: p.refresh_token ?? "",
          })
        : p.code
          ? await supabase.auth.exchangeCodeForSession(p.code)
          : null;
      if (!result || result.error) {
        setRecovering(false);
        setLinkError("That reset link didn't work. Ask for a new one.");
      }
    })();
  }, [url]);

  useEffect(() => {
    // 1. On launch: are we still signed in from last time? (Saved on the phone.)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. From then on: hear about every sign-in and sign-out, wherever it comes from.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // 3. Cleanup: stop listening if this component is ever removed.
    return () => data.subscription.unsubscribe();
  }, []); // [] = run once, after the first render

  // `async` functions return a Promise, and `await` waits for one. (Lesson 1, section 12.)
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? error.message : null;
  }

  async function signUp(name: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Stored with the account; the database trigger copies it into `profiles`
      options: { data: { display_name: name.trim() } },
    });
    if (error) return { error: error.message, needsCode: false };
    // With "Confirm email" on in Supabase there's no session yet: a code was emailed.
    // (With it off you're signed in straight away, and the app carries on.)
    return { error: null, needsCode: data.session === null };
  }

  // The code from the "Confirm your email" email. Right code → signed in.
  async function confirmSignUp(email: string, code: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\s/g, ""),
      type: "signup",
    });
    return error ? error.message : null;
  }

  async function resendSignUpCode(email: string) {
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    return error ? error.message : null;
  }

  // ---- Sign in with Apple (iPhone): Apple's own sheet, no password ----
  async function signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return "Apple didn't send a sign-in. Try again.";
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) return error.message;
      // Apple only tells us your name the very first time: keep it
      const given = credential.fullName?.givenName?.trim();
      const family = credential.fullName?.familyName?.trim();
      const name = [given, family].filter(Boolean).join(" ");
      if (name && data.user) {
        await Promise.all([
          supabase.auth.updateUser({ data: { display_name: name } }),
          supabase.from("profiles").update({ display_name: name }).eq("id", data.user.id),
        ]);
      }
      return null;
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null; // closed the sheet
      return "Couldn't sign in with Apple. Try again.";
    }
  }

  // ---- Sign in with Google: Google's page in a secure browser sheet ----
  // When you're done there, Google sends you back to pantrygo://auth-callback with
  // your sign-in attached, and the sheet closes by itself.
  async function signInWithGoogle() {
    return googleInBrowser(async (redirectTo) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      return { url: data?.url, error: error?.message };
    });
  }

  // Opens Google's page, then uses the sign-in it sends back. Shared by signing in
  // and linking (linking sends back the same account, now with Google added).
  async function googleInBrowser(
    start: (redirectTo: string) => Promise<{ url?: string | null; error?: string }>,
  ): Promise<string | null> {
    const redirectTo = Linking.createURL("auth-callback");
    const { url, error } = await start(redirectTo);
    if (error || !url) return error ?? "Couldn't open Google.";
    const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
    if (result.type !== "success") return null; // closed the sheet
    const p = linkParams(result.url);
    if (p.error || p.error_description)
      return (p.error_description || "Google didn't work.").replace(/\+/g, " ");
    const signedIn = p.code
      ? await supabase.auth.exchangeCodeForSession(p.code)
      : p.access_token
        ? await supabase.auth.setSession({
            access_token: p.access_token,
            refresh_token: p.refresh_token ?? "",
          })
        : null;
    if (!signedIn) return "Google didn't finish. Try again.";
    return signedIn.error ? signedIn.error.message : null;
  }

  // ---- Linking Apple / Google to this account ----
  async function linkApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) return "Apple didn't send anything. Try again.";
      const { error } = await supabase.auth.linkIdentity({
        provider: "apple",
        token: credential.identityToken,
      });
      return error ? linkErrorMessage(error.message, "apple") : null;
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
      return "Couldn't link your Apple ID. Try again.";
    }
  }

  async function linkGoogle() {
    const message = await googleInBrowser(async (redirectTo) => {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      return { url: data?.url, error: error?.message };
    });
    return message ? linkErrorMessage(message, "google") : null;
  }

  async function unlinkProvider(provider: SocialProvider) {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) return error.message;
    const identity = data.identities.find((i) => i.provider === provider);
    if (!identity) return null; // already gone
    if (data.identities.length < 2)
      return "This is the only way you sign in, so it can't be removed.";
    const result = await supabase.auth.unlinkIdentity(identity);
    if (result.error) return result.error.message;
    await supabase.auth.refreshSession(); // so the app's copy of your account catches up
    return null;
  }

  // Your picture goes in two places, like your name: your sign-in details (so it
  // shows straight away for you) and your profile (what housemates see)
  async function setMyAvatar(path: string | null) {
    const id = session?.user.id;
    if (!id) return "You're not signed in.";
    const [a, b] = await Promise.all([
      supabase.auth.updateUser({ data: { avatar: path } }),
      supabase.from("profiles").update({ avatar: path }).eq("id", id),
    ]);
    const message = a.error?.message ?? b.error?.message ?? null;
    if (message?.includes("avatar"))
      return "Profile pictures need a quick database update (supabase/27_avatars_and_social.sql).";
    return message;
  }

  async function signOut() {
    setRecovering(false);
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    return error ? error.message : null;
  }

  // The code from the reset email. Codes don't need the app to open from a link,
  // which email apps often won't do, so this is the main way to reset.
  async function verifyResetCode(email: string, code: string) {
    setRecovering(true); // before the sign-in lands, so the app doesn't flash past the screen
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\s/g, ""),
      type: "recovery",
    });
    if (error) {
      setRecovering(false);
      return error.message;
    }
    return null;
  }

  async function setNewPassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setRecovering(false); // carry on into the app, signed in
    return null;
  }

  async function cancelRecovery() {
    await signOut(); // the link signed you in; cancelling signs you out again
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signIn,
        signUp,
        confirmSignUp,
        resendSignUpCode,
        signOut,
        signInWithApple,
        signInWithGoogle,
        linkApple,
        linkGoogle,
        unlinkProvider,
        setMyAvatar,
        sendPasswordReset,
        verifyResetCode,
        recovering,
        setNewPassword,
        cancelRecovery,
        linkError,
        clearLinkError: () => setLinkError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth() must be used inside <AuthProvider>");
  return value;
}

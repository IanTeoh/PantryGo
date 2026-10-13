import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

// Same pattern as PantryContext: a Provider that owns the state, and a hook to read it.
type AuthContextValue = {
  session: Session | null; // null = signed out
  loading: boolean; // true until we've checked whether you're already signed in
  signIn: (email: string, password: string) => Promise<string | null>; // returns an error message, or null if it worked
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Forgot password: emails a link that opens the app, signed in, to choose a new one
  sendPasswordReset: (email: string) => Promise<string | null>;
  recovering: boolean; // opened from that link: show "Choose a new password"
  setNewPassword: (password: string) => Promise<string | null>;
  cancelRecovery: () => Promise<void>;
  linkError: string | null; // the link was old or already used
  clearLinkError: () => void;
};

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
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Stored with the account; the database trigger copies it into `profiles`
      options: { data: { display_name: name.trim() } },
    });
    return error ? error.message : null;
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
        signOut,
        sendPasswordReset,
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

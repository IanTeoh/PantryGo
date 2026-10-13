import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

// Same pattern as PantryContext: a Provider that owns the state, and a hook to read it.
type AuthContextValue = {
  session: Session | null; // null = signed out
  loading: boolean; // true until we've checked whether you're already signed in
  signIn: (email: string, password: string) => Promise<string | null>; // returns an error message, or null if it worked
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("useAuth() must be used inside <AuthProvider>");
  return value;
}

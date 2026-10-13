import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

// These come from your .env file. Variables starting with EXPO_PUBLIC_ are
// built into the app, so only ever put public values here (never passwords).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env. " +
      "Add them, then restart with `npx expo start --clear`.",
  );
}

// The one connection to Supabase the whole app shares.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage, // remember the sign-in on the phone, so you stay signed in
    autoRefreshToken: true, // quietly renew the sign-in before it expires
    persistSession: true,
    detectSessionInUrl: false, // that's for websites; phones don't sign in via the URL bar
  },
});

// Only keep renewing the sign-in while the app is open on screen.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

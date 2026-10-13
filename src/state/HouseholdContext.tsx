import { Storage } from "expo-sqlite/kv-store";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";

import { useAuth } from "./AuthContext";

export type Household = {
  id: string;
  name: string;
  inviteCode: string;
  role: "admin" | "member"; // my role in it
  ownerId: string; // who made it
  spendingEnabled: boolean; // is the Spending feature on for this household?
};

export type Member = {
  userId: string;
  name: string;
  role: "admin" | "member";
};

type HouseholdContextValue = {
  household: Household | null; // the one you're looking at now; null = not in any yet
  households: Household[]; // every household you're in
  members: Member[]; // who's in the current one
  loading: boolean; // true until we've checked, for this account
  switchHousehold: (id: string) => void;
  // These return an error message, or null if it worked. Creating or joining one
  // switches to it; you stay a member of the others.
  createHousehold: (name: string) => Promise<string | null>;
  joinHousehold: (code: string) => Promise<string | null>;
  leaveHousehold: (householdId?: string) => Promise<string | null>; // default: the current one
  refresh: () => Promise<void>; // reload (e.g. after you change your name)
  // Owner only: turn the Spending feature on or off for a household
  setSpendingEnabled: (householdId: string, enabled: boolean) => Promise<string | null>;
};

// Which household you were last looking at, remembered on this phone per account
const lastKey = (userId: string) => `pantrygo.household.${userId}`;

function readLast(userId: string): string | null {
  try {
    return Storage.getItemSync(lastKey(userId));
  } catch {
    return null;
  }
}

function saveLast(userId: string, householdId: string) {
  try {
    Storage.setItemSync(lastKey(userId), householdId);
  } catch {
    // not saved: next launch just opens the first household
  }
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

// The shape of what Supabase sends back for our query below
type MembershipRow = {
  role: "admin" | "member";
  households: {
    id: string;
    name: string;
    invite_code: string;
    created_by: string;
    spending_enabled: boolean | null;
  } | null;
};

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  // Which account we've finished loading for. Comparing it with the current account
  // tells us whether we're still loading, even after signing out and in as someone else.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // The newest members request, so a slow old one can't overwrite a newer one
  const membersRequest = useRef(0);

  const household = households.find((h) => h.id === currentId) ?? null;

  // Fetch every household I'm in, then pick which one to show.
  // `prefer`: switch to this one if I'm in it (e.g. one I just joined).
  async function load(forUser: string, prefer?: string) {
    // "Which households am I in?" The households(...) part follows the link from
    // household_members.household_id to the households table and brings its columns along.
    const query = (columns: string) =>
      supabase
        .from("household_members")
        .select(`role, households(${columns})`)
        .eq("user_id", forUser)
        .order("joined_at", { ascending: true });
    let { data, error } = await query("id, name, invite_code, created_by, spending_enabled");
    // Before 10_spending.sql has been run there's no spending_enabled column yet:
    // ask again without it, so the app keeps working
    if (error?.message.includes("spending_enabled")) {
      ({ data, error } = await query("id, name, invite_code, created_by"));
    }

    if (error) {
      console.warn("Couldn't load households:", error.message);
      setLoadedFor(forUser);
      return;
    }

    // (Supabase types guess `households` is a list; for this link it is a single row)
    const mine: Household[] = (data as unknown as MembershipRow[])
      .filter((row) => row.households !== null)
      .map((row) => ({
        id: row.households!.id,
        name: row.households!.name,
        inviteCode: row.households!.invite_code,
        role: row.role,
        ownerId: row.households!.created_by,
        spendingEnabled: row.households!.spending_enabled ?? true, // true until 10_spending.sql is run
      }));
    setHouseholds(mine);

    // Which to show: the one asked for, else the last one you looked at, else the first
    const has = (id: string | null | undefined) => !!id && mine.some((h) => h.id === id);
    const last = readLast(forUser);
    const pick = has(prefer)
      ? prefer!
      : has(currentId)
        ? currentId!
        : has(last)
          ? last!
          : (mine[0]?.id ?? null);
    setCurrentId(pick);
    if (pick) {
      saveLast(forUser, pick);
      await loadMembers(pick);
    } else {
      setMembers([]);
    }
    setLoadedFor(forUser);
  }

  // Who's in a household: the memberships, then those people's names
  async function loadMembers(householdId: string) {
    const request = ++membersRequest.current;
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", householdId);
    const ids = (memberRows ?? []).map((m) => m.user_id as string);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    if (request !== membersRequest.current) return; // a newer switch happened meanwhile

    setMembers(
      (memberRows ?? []).map((m) => ({
        userId: m.user_id as string,
        role: m.role as "admin" | "member",
        name: (profiles ?? []).find((p) => p.id === m.user_id)?.display_name || "Someone",
      })),
    );
  }

  // Load whenever the signed-in account changes (sign in, sign out, switch account).
  useEffect(() => {
    if (userId === null) {
      setHouseholds([]);
      setCurrentId(null);
      setMembers([]);
      setLoadedFor(null);
      return;
    }
    load(userId);

    // Coming back to the app: reload, in case someone joined or a household was renamed
    const id = userId;
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") load(id);
    });
    return () => appState.remove();
  }, [userId]);

  // Show a different household. Every screen follows, because the pantry, shopping
  // list, recipes and budget all reload when household.id changes.
  function switchHousehold(id: string) {
    if (!userId || id === currentId || !households.some((h) => h.id === id)) return;
    setCurrentId(id);
    setMembers([]);
    saveLast(userId, id);
    loadMembers(id);
  }

  async function createHousehold(name: string) {
    if (!userId) return "You're not signed in.";
    // .rpc() calls one of the functions from schema.sql. It returns the new household's id.
    const { data, error } = await supabase.rpc("create_household", { p_name: name.trim() });
    if (error) return error.message;
    await load(userId, data as string);
    return null;
  }

  async function joinHousehold(code: string) {
    if (!userId) return "You're not signed in.";
    const { data, error } = await supabase.rpc("join_household", { p_code: code });
    if (error) {
      return error.message.includes("invite code")
        ? "No household has that code. Check it and try again."
        : error.message;
    }
    await load(userId, data as string);
    return null;
  }

  async function leaveHousehold(householdId?: string) {
    const leaving = households.find((h) => h.id === (householdId ?? currentId));
    if (!userId || !leaving) return null;
    // Allowed by the "leave household" rule: you can delete your own membership row
    const { error } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", leaving.id)
      .eq("user_id", userId);
    if (error) return error.message;
    if (leaving.id !== currentId) {
      await load(userId); // left one you weren't looking at: stay where you are
      return null;
    }
    // Show one of the others. With none left, the app goes to the setup screen.
    const next = households.find((h) => h.id !== leaving.id)?.id;
    setCurrentId(next ?? null);
    await load(userId, next);
    return null;
  }

  async function refresh() {
    if (userId) await load(userId);
  }

  async function setSpendingEnabled(householdId: string, enabled: boolean) {
    // Show the change straight away, then save it (the database checks you're the owner)
    setHouseholds((prev) =>
      prev.map((h) => (h.id === householdId ? { ...h, spendingEnabled: enabled } : h)),
    );
    const { error } = await supabase.rpc("set_spending_enabled", {
      p_household_id: householdId,
      p_enabled: enabled,
    });
    if (userId) await load(userId); // match the database again, whether it worked or not
    return error ? error.message : null;
  }

  const loading = userId !== null && loadedFor !== userId;

  return (
    <HouseholdContext.Provider
      value={{
        household,
        households,
        members,
        loading,
        switchHousehold,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        setSpendingEnabled,
        refresh,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext);
  if (value === null) throw new Error("useHousehold() must be used inside <HouseholdProvider>");
  return value;
}

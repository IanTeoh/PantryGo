import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import type { Expense, ExpenseSource } from "@/utils/budget";
import { makeId } from "@/utils/ids";

import { useAuth } from "./AuthContext";
import { useHousehold } from "./HouseholdContext";
import { useLiveUpdates } from "./useLiveUpdates";
import { useSaveQueue } from "./useSaveQueue";

type NewPurchase = {
  description: string;
  amount: number;
  paidBy?: string; // defaults to you
  shared?: boolean; // defaults to true (split with the household)
  // Who it's split between (defaults to everyone). Just the payer = a personal cost.
  splitWith?: string[];
  source?: Exclude<ExpenseSource, "settlement">; // where it came from (default: typed in)
};

type BudgetContextValue = {
  expenses: Expense[]; // newest first
  loading: boolean;
  refresh: () => Promise<void>;
  addPurchase: (purchase: NewPurchase) => void;
  recordSettlement: (from: string, to: string, amount: number) => void;
  deleteExpense: (id: string) => void;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

type ExpenseRow = {
  id: string;
  kind: "purchase" | "settlement";
  source: ExpenseSource | null;
  description: string;
  amount: number | string;
  paid_by: string | null;
  paid_to: string | null;
  shared: boolean;
  split_with: string[] | null;
  created_by: string | null;
  at: string;
};

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source ?? (row.kind === "settlement" ? "settlement" : "manual"),
    description: row.description,
    amount: Number(row.amount),
    paidBy: row.paid_by,
    paidTo: row.paid_to,
    shared: row.shared,
    splitWith: row.split_with ?? null,
    createdBy: row.created_by,
    at: Date.parse(row.at),
  };
}

// Same shape as the pantry and shopping stores: load, live updates, optimistic saves.
export function BudgetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const me = session?.user.id ?? null;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  async function load(forHousehold: string) {
    // All of them: balances need the whole history, not just this month
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("household_id", forHousehold)
      .order("at", { ascending: false })
      .limit(2000);
    if (isSaving()) return;
    if (error) console.warn("Couldn't load spending:", error.message);
    else setExpenses((data as ExpenseRow[]).map(toExpense));
    setLoadedFor(forHousehold);
  }

  useEffect(() => {
    if (householdId === null) {
      setExpenses([]);
      setLoadedFor(null);
      return;
    }
    load(householdId);
  }, [householdId]);

  async function refresh() {
    if (householdId) await load(householdId);
  }

  const { save, isSaving } = useSaveQueue(refresh);
  useLiveUpdates("budget", ["expenses"], householdId, () => {
    if (!isSaving()) refresh();
  });

  function insert(expense: Omit<Expense, "id" | "createdBy" | "at">) {
    if (!householdId || !me) return;
    const temp: Expense = { ...expense, id: `temp-${makeId()}`, createdBy: me, at: Date.now() };
    save(
      () => setExpenses((prev) => [temp, ...prev]),
      () =>
        supabase.from("expenses").insert({
          household_id: householdId,
          kind: expense.kind,
          source: expense.source,
          description: expense.description,
          amount: Math.round(expense.amount * 100) / 100,
          paid_by: expense.paidBy,
          paid_to: expense.paidTo,
          shared: expense.shared,
          // Only send a list if one was chosen; the database fills in "everyone" otherwise
          ...(expense.splitWith ? { split_with: expense.splitWith } : {}),
        }),
    );
  }

  function addPurchase({
    description,
    amount,
    paidBy,
    shared = true,
    splitWith,
    source = "manual",
  }: NewPurchase) {
    if (!(amount > 0) || !description.trim()) return;
    const payer = paidBy ?? me;
    // Split with only the person who paid = it's just theirs
    const personal = !shared || (splitWith?.length === 1 && splitWith[0] === payer);
    insert({
      kind: "purchase",
      source,
      description: description.trim(),
      amount,
      paidBy: payer,
      paidTo: null,
      shared: !personal,
      splitWith: personal ? null : (splitWith ?? null),
    });
  }

  function recordSettlement(from: string, to: string, amount: number) {
    if (!(amount > 0)) return;
    insert({
      kind: "settlement",
      source: "settlement",
      description: "Paid back",
      amount,
      paidBy: from,
      paidTo: to,
      shared: false,
      splitWith: null,
    });
  }

  function deleteExpense(id: string) {
    save(
      () => setExpenses((prev) => prev.filter((e) => e.id !== id)),
      () => supabase.from("expenses").delete().eq("id", id),
    );
  }

  return (
    <BudgetContext.Provider
      value={{
        expenses,
        loading: householdId !== null && loadedFor !== householdId,
        refresh,
        addPurchase,
        recordSettlement,
        deleteExpense,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget(): BudgetContextValue {
  const value = useContext(BudgetContext);
  if (value === null) throw new Error("useBudget() must be used inside <BudgetProvider>");
  return value;
}

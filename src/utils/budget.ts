// Plain functions for money: who paid what, and who owes whom. No React here.

// Where a cost came from
export type ExpenseSource = "manual" | "receipt" | "item" | "settlement";

export type Expense = {
  id: string;
  kind: "purchase" | "settlement";
  source: ExpenseSource;
  description: string;
  amount: number; // NZ dollars
  paidBy: string | null;
  paidTo: string | null; // settlements only
  shared: boolean; // split between people? (false = personal)
  // Exactly who a shared cost is split between. null = everyone in the household
  // (only for old costs from before 11_split_with.sql).
  splitWith: string[] | null;
  createdBy: string | null;
  at: number;
};

// 12.4 → "$12.40"
export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-NZ", { style: "currency", currency: "NZD" });
}

// Round to whole cents, so 0.1 + 0.2 doesn't show as $0.30000000004
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

// Who a shared purchase is split between: its own list, or else everyone
export function splitOf(e: Expense, memberIds: string[]): string[] {
  return e.splitWith && e.splitWith.length > 0 ? e.splitWith : memberIds;
}

// Everyone's balance. Positive = the household owes you; negative = you owe.
//   Shared purchase of $60 by Alex, 3 people: Alex +60, everyone (Alex too) −20 → Alex +40, others −20
//   Settlement of $20 from Sam to Alex: Sam +20, Alex −20
export function balances(expenses: Expense[], memberIds: string[]): Map<string, number> {
  const result = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string | null, amount: number) => {
    if (id !== null && result.has(id)) result.set(id, result.get(id)! + amount);
  };

  for (const e of expenses) {
    if (e.kind === "settlement") {
      add(e.paidBy, e.amount);
      add(e.paidTo, -e.amount);
    } else if (e.shared) {
      const split = splitOf(e, memberIds);
      if (split.length === 0) continue;
      add(e.paidBy, e.amount);
      const share = e.amount / split.length;
      for (const id of split) add(id, -share);
    }
  }
  for (const [id, value] of result) result.set(id, cents(value));
  return result;
}

export type Transfer = { from: string; to: string; amount: number };

// The fewest payments that would square everyone up: whoever owes most pays
// whoever is owed most, and so on until everyone's at zero.
export function settleUp(balanceMap: Map<string, number>): Transfer[] {
  const owes = [...balanceMap].filter(([, b]) => b < -0.005).map(([id, b]) => ({ id, left: -b }));
  const owed = [...balanceMap].filter(([, b]) => b > 0.005).map(([id, b]) => ({ id, left: b }));
  owes.sort((a, b) => b.left - a.left);
  owed.sort((a, b) => b.left - a.left);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < owes.length && j < owed.length) {
    const amount = cents(Math.min(owes[i].left, owed[j].left));
    if (amount > 0) transfers.push({ from: owes[i].id, to: owed[j].id, amount });
    owes[i].left = cents(owes[i].left - amount);
    owed[j].left = cents(owed[j].left - amount);
    if (owes[i].left <= 0.005) i++;
    if (owed[j].left <= 0.005) j++;
  }
  return transfers;
}

// Purchases only (paying someone back isn't spending)
export function totalSpent(expenses: Expense[]): number {
  return cents(expenses.filter((e) => e.kind === "purchase").reduce((sum, e) => sum + e.amount, 0));
}

// How much each person paid for purchases, biggest first
export function spentByPerson(expenses: Expense[]): { userId: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.kind !== "purchase" || e.paidBy === null) continue;
    totals.set(e.paidBy, (totals.get(e.paidBy) ?? 0) + e.amount);
  }
  return [...totals]
    .map(([userId, amount]) => ({ userId, amount: cents(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Between you and each other person
// ---------------------------------------------------------------------------
// For every shared purchase, each person in its split owes the payer an equal share. Paying
// someone back cancels that out. Netting it all per person gives:
//   positive = they owe you, negative = you owe them.

// How one expense changes what's owed between `me` and `other`
//   (positive = moves it towards them owing me)
export function effectBetween(e: Expense, memberIds: string[], me: string, other: string): number {
  if (e.kind === "settlement") {
    if (e.paidBy === me && e.paidTo === other) return e.amount; // I paid them back
    if (e.paidBy === other && e.paidTo === me) return -e.amount; // they paid me back
    return 0;
  }
  if (!e.shared) return 0;
  const split = splitOf(e, memberIds);
  if (split.length === 0) return 0;
  const share = e.amount / split.length;
  if (e.paidBy === me && split.includes(other)) return share; // I paid: they owe me their share
  if (e.paidBy === other && split.includes(me)) return -share; // they paid: I owe them mine
  return 0; // someone else paid, or one of us isn't in the split
}

export type Pair = { userId: string; amount: number }; // amount: + they owe me, − I owe them

// Everyone else in the household, with what's owed between you
export function balancesWithMe(expenses: Expense[], memberIds: string[], me: string): Pair[] {
  return memberIds
    .filter((id) => id !== me)
    .map((other) => ({
      userId: other,
      amount: cents(expenses.reduce((sum, e) => sum + effectBetween(e, memberIds, me, other), 0)),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

// The costs behind one person's balance, newest first, each with its effect
export function breakdownWith(
  expenses: Expense[],
  memberIds: string[],
  me: string,
  other: string,
): { expense: Expense; effect: number }[] {
  return expenses
    .map((expense) => ({ expense, effect: cents(effectBetween(expense, memberIds, me, other)) }))
    .filter((x) => x.effect !== 0)
    .sort((a, b) => b.expense.at - a.expense.at);
}

// Someone's share of a shared purchase (what it cost them). 0 if they're not in the split.
export function myShare(e: Expense, memberIds: string[], me: string): number {
  if (e.kind !== "purchase" || !e.shared) return 0;
  const split = splitOf(e, memberIds);
  return split.includes(me) ? cents(e.amount / split.length) : 0;
}

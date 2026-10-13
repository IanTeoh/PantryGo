import type { PantryEvent } from "@/state/PantryContext";

// Plain functions that turn the activity log into Impact numbers.
// No React here: events in, numbers out. Easy to check by hand.

export type MonthTotals = {
  key: string; // "2026-10"
  label: string; // "Oct"
  used: number; // packs used
  wasted: number; // packs thrown out
};

// "2026-10" for any moment in October 2026 (local time)
export function monthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// The first moment of the month `monthsAgo` months back, e.g. startOfMonth(5) in Oct = 1 May
export function startOfMonth(monthsAgo: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1); // months roll over years
}

// Used vs thrown out, for each of the last `count` months (oldest first)
export function monthlyTotals(events: PantryEvent[], count: number): MonthTotals[] {
  const months: MonthTotals[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = startOfMonth(i);
    months.push({
      key: monthKey(start.getTime()),
      label: start.toLocaleDateString("en-NZ", { month: "short" }),
      used: 0,
      wasted: 0,
    });
  }

  for (const e of events) {
    const month = months.find((m) => m.key === monthKey(e.at));
    if (!month || e.portion === null) continue; // outside the range, or no portion recorded
    if (e.type === "used") month.used += e.portion;
    if (e.type === "wasted") month.wasted += e.portion;
  }
  return months;
}

// Share of food thrown out: wasted ÷ (used + wasted). null when there's nothing yet.
export function wasteRate(used: number, wasted: number): number | null {
  const total = used + wasted;
  return total > 0 ? wasted / total : null;
}

// The things thrown out most often, biggest first
export function mostWasted(events: PantryEvent[], limit: number) {
  const byName = new Map<string, { name: string; portion: number; times: number }>();
  for (const e of events) {
    if (e.type !== "wasted") continue;
    const key = e.itemName.trim().toLowerCase(); // "Spinach" and "spinach" count together
    const entry = byName.get(key) ?? { name: e.itemName, portion: 0, times: 0 };
    entry.portion += e.portion ?? 0;
    entry.times += 1;
    byName.set(key, entry);
  }
  return [...byName.values()].sort((a, b) => b.portion - a.portion).slice(0, limit);
}

// Whole days since anything was last thrown out, or null if nothing has been
export function daysSinceWaste(events: PantryEvent[]): number | null {
  const lastWaste = events.filter((e) => e.type === "wasted").sort((a, b) => b.at - a.at)[0];
  if (!lastWaste) return null;
  return Math.floor((Date.now() - lastWaste.at) / (1000 * 60 * 60 * 24));
}

// Packs used per person, biggest first
export function usedByPerson(events: PantryEvent[]) {
  const totals = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "used" || e.userId === null || e.portion === null) continue;
    totals.set(e.userId, (totals.get(e.userId) ?? 0) + e.portion);
  }
  return [...totals.entries()]
    .map(([userId, packs]) => ({ userId, packs }))
    .sort((a, b) => b.packs - a.packs);
}

// 6.43 → "6.4", 0.25 → "0.3", 12 → "12"
export function formatPacks(n: number): string {
  return String(Math.round(n * 10) / 10);
}

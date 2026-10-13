export function daysUntil(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return 0;
  }

  const [, year, month, day] = match;
  const target = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// The date `days` days from today, as "YYYY-MM-DD" in local time.
// addDays(0) = today, addDays(7) = a week from today.
export function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days); // JavaScript rolls over months/years for us
  return toIsoDate(d);
}

// A JavaScript Date → "YYYY-MM-DD" in local time (how the app stores dates)
export function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0"); // months start at 0
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "YYYY-MM-DD" → a JavaScript Date at local midnight (what date pickers want)
export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// 0 → "Today", 1 → "Tomorrow", 5 → "In 5 days", −2 → "2 days ago"
export function relativeDays(isoDate: string): string {
  const n = daysUntil(isoDate);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

// "2026-10-10" → "Sat, 10 Oct"
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

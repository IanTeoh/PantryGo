// A unique-enough id for things created on this phone, e.g. "lq3k9z-4f2a1".
// (Supabase will make the real ids in Lesson 3.)
export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

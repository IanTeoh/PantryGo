import type { User } from "@supabase/supabase-js";

// Your name and picture, from your sign-in details. Email sign-ups store
// display_name; Google sends full_name / name and a photo link; Apple sends the
// name only the first time (we save it as display_name then).

export function myName(user: User | null | undefined): string {
  const m = user?.user_metadata ?? {};
  return (
    (m.display_name as string | undefined) ||
    (m.full_name as string | undefined) ||
    (m.name as string | undefined) ||
    ""
  ).trim();
}

// A stored picture path ("<id>/<random>.jpg" in the avatars bucket), a Google photo
// link, or null. `avatar` is null (not missing) once you've removed your picture.
export function myAvatar(user: User | null | undefined): string | null {
  const m = user?.user_metadata ?? {};
  if ("avatar" in m) return (m.avatar as string | null) ?? null;
  return (m.avatar_url as string | undefined) || (m.picture as string | undefined) || null;
}

// Apple's "Hide my email" addresses, e.g. abc123@privaterelay.appleid.com
export function isHiddenAppleEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

// Can you sign in with your email and a password? True if you signed up that way,
// or set a password later (we note that, because Supabase doesn't list it for
// accounts made with Apple or Google).
export function hasPassword(user: User | null | undefined): boolean {
  return (
    !!user?.identities?.some((i) => i.provider === "email") ||
    user?.user_metadata?.has_password === true
  );
}

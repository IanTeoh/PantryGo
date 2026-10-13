import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";

import { FilterChips } from "./FilterChips";

// Pick one person in the household, e.g. "Who paid?". You're listed first, as "Me".
export function MemberChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (userId: string) => void;
}) {
  const { session } = useAuth();
  const { members } = useHousehold();
  const me = session?.user.id;

  const options = [...members]
    .sort((a, b) => (a.userId === me ? -1 : b.userId === me ? 1 : a.name.localeCompare(b.name)))
    .map((m) => ({ value: m.userId, label: m.userId === me ? "Me" : m.name }));

  return <FilterChips options={options} selected={selected} onSelect={onSelect} />;
}

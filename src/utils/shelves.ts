import type { Item, Location } from "@/types";
import { AISLES, typeOf, type Aisle } from "@/utils/aisles";
import { compareByExpiry, getFreshness } from "@/utils/freshness";

// ---------------------------------------------------------------------------
// The pantry as a library of shelves: by type (Spices & herbs, Dairy & eggs…)
// or by where things are kept (Fridge, Freezer, Pantry). Tap a shelf to open it.
// Plain functions, no React.
// ---------------------------------------------------------------------------

export type ShelfBy = "type" | "place";
export type ShelfKey = Aisle | Location | "soon";

export const LOCATIONS: { key: Location; label: string }[] = [
  { key: "fridge", label: "Fridge" },
  { key: "freezer", label: "Freezer" },
  { key: "pantry", label: "Pantry" },
];

// In stock, and its use-by is close
export const isSoon = (it: Item) =>
  it.quantity > 0 && ["urgent", "soon"].includes(getFreshness(it));

export type Shelf = { key: ShelfKey; label: string; items: Item[]; soon: number };

// Every shelf that has something on it, in order, each sorted soonest use-by first
export function shelvesFor(items: Item[], by: ShelfBy): Shelf[] {
  const groups = by === "type" ? AISLES : LOCATIONS;
  return groups
    .map((g) => {
      const onShelf = items
        .filter((it) => (by === "type" ? typeOf(it) === g.key : it.location === g.key))
        .sort(compareByExpiry);
      return { key: g.key, label: g.label, items: onShelf, soon: onShelf.filter(isSoon).length };
    })
    .filter((s) => s.items.length > 0);
}

// One shelf's items (or the "Use soon" one)
export function shelfItems(items: Item[], by: ShelfBy, key: ShelfKey): Item[] {
  if (key === "soon") return items.filter(isSoon).sort(compareByExpiry);
  return shelvesFor(items, by).find((s) => s.key === key)?.items ?? [];
}

export function shelfLabel(by: ShelfBy, key: ShelfKey): string {
  if (key === "soon") return "Use soon";
  const groups: { key: string; label: string }[] = by === "type" ? AISLES : LOCATIONS;
  return groups.find((g) => g.key === key)?.label ?? "";
}

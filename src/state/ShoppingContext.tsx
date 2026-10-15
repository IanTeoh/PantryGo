import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";
import type { Location } from "@/types";
import { makeId } from "@/utils/ids";
import { sameName } from "@/utils/stock";
import { guessContainer, roundAmount } from "@/utils/units";

import { useHousehold } from "./HouseholdContext";
import { usePantry } from "./PantryContext";
import { useLiveUpdates } from "./useLiveUpdates";
import { useSaveQueue } from "./useSaveQueue";

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: number | null; // null = "some"
  unit: string | null;
  itemId: string | null; // the pantry item this tops up, if any
  done: boolean; // ticked off: in the trolley
  addedBy: string | null;
  createdAt: number;
};

// Adding to the list is just a name. How much you bought is asked when you put it away.
type NewShoppingItem = {
  name: string;
  itemId?: string | null; // the pantry item it tops up, if known
};

// What you confirm for each thing on the put-away screen
export type PutAwayEntry = {
  rowId: string; // the shopping list row
  amount: number; // how much you bought, in `unit`
  unit: string;
  location: Location;
  expiry: string | null; // "YYYY-MM-DD", or null
};

// The pantry item a list row tops up: the linked one, or one with the same name
export function pantryMatch<T extends { id: string; name: string }>(
  row: { itemId: string | null; name: string },
  items: T[],
): T | undefined {
  return (
    items.find((it) => it.id === row.itemId) ?? items.find((it) => sameName(it.name, row.name))
  );
}

type ShoppingContextValue = {
  list: ShoppingItem[];
  loading: boolean;
  live: boolean;
  refresh: () => Promise<void>;
  addToList: (item: NewShoppingItem) => void;
  toggleDone: (id: string) => void;
  removeFromList: (id: string) => void;
  clearDone: () => void; // remove ticked items without putting them away
  putAway: (entries: PutAwayEntry[]) => void; // move these into the pantry, off the list
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

type ShoppingRow = {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  item_id: string | null;
  done: boolean;
  added_by: string | null;
  created_at: string;
};

function toShoppingItem(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    itemId: row.item_id,
    done: row.done,
    addedBy: row.added_by,
    createdAt: Date.parse(row.created_at),
  };
}

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  // The shopping list talks to the pantry when putting things away
  const { items, setQuantity, addItem, updateItem } = usePantry();

  const [list, setList] = useState<ShoppingItem[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  async function load(forHousehold: string) {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("household_id", forHousehold)
      .order("created_at", { ascending: true }); // oldest first: the order things were added
    if (isSaving()) return;
    if (error) console.warn("Couldn't load shopping list:", error.message);
    else setList((data as ShoppingRow[]).map(toShoppingItem));
    setLoadedFor(forHousehold);
  }

  useEffect(() => {
    if (householdId === null) {
      setList([]);
      setLoadedFor(null);
      return;
    }
    load(householdId);
  }, [householdId]);

  async function refresh() {
    if (householdId) await load(householdId);
  }

  // The same two hooks the pantry uses
  const { save, isSaving } = useSaveQueue(refresh);
  const live = useLiveUpdates("shopping", ["shopping_items"], householdId, () => {
    if (!isSaving()) refresh();
  });

  function addToList({ name, itemId = null }: NewShoppingItem) {
    if (!householdId || !name.trim()) return;
    const temp: ShoppingItem = {
      id: `temp-${makeId()}`,
      name: name.trim(),
      quantity: null,
      unit: null,
      itemId,
      done: false,
      addedBy: null,
      createdAt: Date.now(),
    };
    save(
      () => setList((prev) => [...prev, temp]),
      () =>
        supabase.from("shopping_items").insert({
          household_id: householdId,
          name: temp.name,
          item_id: itemId,
        }),
    );
  }

  function toggleDone(id: string) {
    const row = list.find((r) => r.id === id);
    if (!row) return;
    save(
      () => setList((prev) => prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))),
      () => supabase.from("shopping_items").update({ done: !row.done }).eq("id", id),
    );
  }

  function removeFromList(id: string) {
    save(
      () => setList((prev) => prev.filter((r) => r.id !== id)),
      () => supabase.from("shopping_items").delete().eq("id", id),
    );
  }

  function clearDone() {
    const ids = list.filter((r) => r.done).map((r) => r.id);
    if (ids.length === 0) return;
    save(
      () => setList((prev) => prev.filter((r) => !r.done)),
      // .in("id", ids) = "where id is one of these": one request for all of them
      () => supabase.from("shopping_items").delete().in("id", ids),
    );
  }

  function putAway(entries: PutAwayEntry[]) {
    for (const entry of entries) {
      const row = list.find((r) => r.id === entry.rowId);
      if (!row || !(entry.amount > 0)) continue;
      const existing = pantryMatch(row, items);

      if (existing) {
        // Top it up (in the item's own unit). If that's more than a "full" one,
        // setQuantity makes the full size bigger to fit.
        setQuantity(existing.id, roundAmount(existing.quantity + entry.amount));
        // A fresh pack usually lasts longer: use its date if one was given
        if (entry.expiry) {
          updateItem(existing.id, {
            name: existing.name,
            unit: existing.unit,
            container: existing.container,
            location: existing.location,
            expiry: entry.expiry,
            capacity: existing.capacity,
          });
        }
      } else {
        // Something new: a full one of what you bought
        addItem({
          name: row.name,
          quantity: entry.amount,
          capacity: entry.amount,
          unit: entry.unit,
          container: guessContainer(entry.unit, row.name),
          location: entry.location,
          expiry: entry.expiry,
        });
      }
    }

    // Take them off the list
    const ids = entries.map((e) => e.rowId);
    save(
      () => setList((prev) => prev.filter((r) => !ids.includes(r.id))),
      () => supabase.from("shopping_items").delete().in("id", ids),
    );
  }

  return (
    <ShoppingContext.Provider
      value={{
        list,
        loading: householdId !== null && loadedFor !== householdId,
        live,
        refresh,
        addToList,
        toggleDone,
        removeFromList,
        clearDone,
        putAway,
      }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping(): ShoppingContextValue {
  const value = useContext(ShoppingContext);
  if (value === null) throw new Error("useShopping() must be used inside <ShoppingProvider>");
  return value;
}

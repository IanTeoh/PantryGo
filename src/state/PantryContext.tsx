import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { isAisle, type Aisle } from "@/utils/aisles";
import { supabase } from "@/lib/supabase";
import type { ContainerType, Item, Location, Nutrition } from "@/types";
import { makeId } from "@/utils/ids";
import { roundAmount } from "@/utils/units";

import { useHousehold } from "./HouseholdContext";
import { useLiveUpdates } from "./useLiveUpdates";
import { useSaveQueue } from "./useSaveQueue";

// ---------------------------------------------------------------------------
// The activity log: one entry for every change to the pantry.
// ---------------------------------------------------------------------------
export type PantryEventType = "added" | "used" | "restocked" | "wasted" | "removed";

export type PantryEvent = {
  id: string;
  type: PantryEventType;
  itemId: string | null; // null once the item has been deleted
  itemName: string;
  amount: number; // always positive; `type` says which direction
  unit: string;
  userId: string | null; // who did it
  at: number; // when it happened (milliseconds since 1970)
  // The amount as a fraction of a full pack: 250 ml of a 1000 ml bottle = 0.25.
  // Unlike amounts, portions can be added up across units. (null for old entries)
  portion: number | null;
};

type PantryContextValue = {
  items: Item[];
  events: PantryEvent[];
  loading: boolean; // true until the first load finishes
  live: boolean; // connected to live updates right now?
  refresh: () => Promise<void>; // fetch everything again (pull-to-refresh)
  changeQuantity: (id: string, delta: number) => void; // + / − buttons
  setQuantity: (id: string, newQuantity: number) => void; // dragging the gauge, "Used it all"
  addItem: (item: Omit<Item, "id">) => void;
  discardItem: (id: string) => void; // "Threw it out": counts as waste
  removeItem: (id: string) => void; // delete from the list entirely
  updateItem: (id: string, details: ItemDetails) => void; // fix name, location, date…
  setItemNutrition: (id: string, nutrition: Nutrition | null) => void; // calories etc.
  setItemCategory: (id: string, category: Aisle | null) => void; // its type; null = automatic
  // Undo an activity-log entry: puts the pantry back and removes the entry.
  // Returns an error message, or null if it worked.
  undoEvent: (eventId: string) => Promise<string | null>;
};

// The parts of an item you can edit. (Pick<> = "just these fields of Item".)
// How much is left isn't here: that's changed with setQuantity, which logs it.
export type ItemDetails = Pick<
  Item,
  "name" | "unit" | "container" | "location" | "expiry" | "capacity"
>;

const PantryContext = createContext<PantryContextValue | null>(null);

// ---------------------------------------------------------------------------
// Database rows → app types.
// The database uses snake_case names and sends dates as text; the app uses
// camelCase and numbers. These two functions are the only place that knows both.
// ---------------------------------------------------------------------------
type ItemRow = {
  id: string;
  name: string;
  quantity: number | string;
  capacity: number | string;
  unit: string;
  container: ContainerType;
  location: Location;
  expiry: string | null;
  barcode: string | null;
  kcal: number | string | null;
  protein: number | string | null;
  carbs: number | string | null;
  fat: number | string | null;
  category?: string | null; // (missing until 16_item_types.sql has been run)
};

export type EventRow = {
  id: string;
  type: PantryEventType;
  item_id: string | null;
  item_name: string;
  amount: number | string;
  unit: string;
  user_id: string | null;
  at: string;
  portion: number | string | null;
};

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity), // Number(): make sure it's a number, not text
    capacity: Number(row.capacity),
    unit: row.unit,
    container: row.container,
    location: row.location,
    expiry: row.expiry,
    barcode: row.barcode,
    category: isAisle(row.category) ? row.category : null,
    // No calories = nutrition not known
    nutrition:
      row.kcal === null
        ? null
        : {
            kcal: Number(row.kcal),
            protein: numOrNull(row.protein),
            carbs: numOrNull(row.carbs),
            fat: numOrNull(row.fat),
          },
  };
}

function numOrNull(v: number | string | null): number | null {
  return v === null ? null : Number(v);
}

export function toEvent(row: EventRow): PantryEvent {
  return {
    id: row.id,
    type: row.type,
    itemId: row.item_id,
    itemName: row.item_name,
    amount: Number(row.amount),
    unit: row.unit,
    userId: row.user_id,
    at: Date.parse(row.at), // "2026-10-07T08:15:00Z" → milliseconds
    portion: row.portion === null ? null : Number(row.portion),
  };
}

// null clears it (every argument null)
function nutritionRpc(id: string, n: Nutrition | null) {
  return supabase.rpc("set_item_nutrition", {
    p_item_id: id,
    p_kcal: n?.kcal ?? null,
    p_protein: n?.protein ?? null,
    p_carbs: n?.carbs ?? null,
    p_fat: n?.fat ?? null,
  });
}

// ---------------------------------------------------------------------------
// The Provider
// ---------------------------------------------------------------------------
// "Simple bar" needs supabase/23_simple_bar.sql. Until that's run the database
// refuses it, so save the item with a bag shape instead of losing it.
function shapeNotKnownYet(error: { message: string } | null, container: ContainerType): boolean {
  return error !== null && container === "plain" && error.message.includes("container");
}

export function PantryProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;

  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<PantryEvent[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // ---- Loading ----
  async function load(forHousehold: string) {
    // Ask for items and the latest 50 log entries at the same time.
    // Promise.all waits for both, instead of one after the other.
    const [itemsResult, eventsResult] = await Promise.all([
      supabase.from("items").select("*").eq("household_id", forHousehold).order("name"),
      supabase
        .from("events")
        .select("*")
        .eq("household_id", forHousehold)
        .order("at", { ascending: false })
        .limit(50),
    ]);

    // If you've made more changes while this was loading, this data is already
    // out of date. Skip it: another load runs once those saves finish.
    if (isSaving()) return;

    if (itemsResult.error || eventsResult.error) {
      console.warn(
        "Couldn't load pantry:",
        itemsResult.error?.message ?? eventsResult.error?.message,
      );
    } else {
      setItems((itemsResult.data as ItemRow[]).map(toItem));
      setEvents((eventsResult.data as EventRow[]).map(toEvent));
    }
    setLoadedFor(forHousehold);
  }

  // Load whenever the household changes (joining, leaving, signing in as someone else)
  useEffect(() => {
    if (householdId === null) {
      setItems([]);
      setEvents([]);
      setLoadedFor(null);
      return;
    }
    load(householdId);
  }, [householdId]);

  async function refresh() {
    if (householdId) await load(householdId);
  }

  // ---- Saving (see useSaveQueue.ts) and live updates (see useLiveUpdates.ts) ----
  const { save, isSaving } = useSaveQueue(refresh);
  const live = useLiveUpdates("pantry", ["items", "events"], householdId, () => {
    if (!isSaving()) refresh(); // our own saves reload by themselves
  });

  function setQuantity(id: string, newQuantity: number) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const next = roundAmount(Math.max(0, newQuantity));
    if (next === item.quantity) return; // nothing changed

    save(
      () =>
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, quantity: next, capacity: Math.max(it.capacity, next) } : it,
          ),
        ),
      () => supabase.rpc("set_item_quantity", { p_item_id: id, p_quantity: next }),
    );
  }

  // The + / − buttons are just "set it to the current amount plus delta"
  function changeQuantity(id: string, delta: number) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    setQuantity(id, item.quantity + delta);
  }

  function addItem(newItem: Omit<Item, "id">) {
    if (!householdId) return;
    // A temporary id until the database gives us the real one on the next load
    const tempId = `temp-${makeId()}`;

    save(
      () => setItems((prev) => [...prev, { ...newItem, id: tempId }]),
      async () => {
        const send = (container: ContainerType) =>
          supabase.rpc("add_item", {
            p_household_id: householdId,
            p_name: newItem.name,
            p_quantity: newItem.quantity,
            p_capacity: newItem.capacity,
            p_unit: newItem.unit,
            p_container: container,
            p_location: newItem.location,
            p_expiry: newItem.expiry,
            p_barcode: newItem.barcode ?? null,
          });
        let added = await send(newItem.container);
        if (shapeNotKnownYet(added.error, newItem.container)) added = await send("bag");
        // add_item gives back the new item's id: use it to save the nutrition too
        if (added.error) return added;
        const newId = added.data as string;
        if (newItem.nutrition) {
          const saved = await nutritionRpc(newId, newItem.nutrition);
          if (saved.error) return saved;
        }
        if (newItem.category) {
          return supabase.rpc("set_item_category", {
            p_item_id: newId,
            p_category: newItem.category,
          });
        }
        return added;
      },
    );
  }

  function setItemNutrition(id: string, nutrition: Nutrition | null) {
    save(
      () => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, nutrition } : it))),
      () => nutritionRpc(id, nutrition),
    );
  }

  function setItemCategory(id: string, category: Aisle | null) {
    save(
      () => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, category } : it))),
      () => supabase.rpc("set_item_category", { p_item_id: id, p_category: category }),
    );
  }

  async function undoEvent(eventId: string) {
    const { error } = await supabase.rpc("undo_event", { p_event_id: eventId });
    if (error) {
      return error.message.includes("undo_event")
        ? "Undo isn't set up yet. Run supabase/17_undo_activity.sql in Supabase."
        : error.message;
    }
    // Show the change straight away (refresh() below brings the exact numbers)
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    await refresh();
    return null;
  }

  function discardItem(id: string) {
    save(
      () => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: 0 } : it))),
      () => supabase.rpc("discard_item", { p_item_id: id }),
    );
  }

  function removeItem(id: string) {
    save(
      () => setItems((prev) => prev.filter((it) => it.id !== id)),
      () => supabase.rpc("remove_item", { p_item_id: id }),
    );
  }

  function updateItem(id: string, details: ItemDetails) {
    save(
      () =>
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, ...details, capacity: Math.max(details.capacity, it.quantity) }
              : it,
          ),
        ),
      async () => {
        const send = (container: ContainerType) =>
          supabase.rpc("update_item", {
            p_item_id: id,
            p_name: details.name,
            p_unit: details.unit,
            p_container: container,
            p_location: details.location,
            p_expiry: details.expiry,
            p_capacity: details.capacity,
          });
        const updated = await send(details.container);
        return shapeNotKnownYet(updated.error, details.container) ? send("bag") : updated;
      },
    );
  }

  const value: PantryContextValue = {
    items,
    events,
    loading: householdId !== null && loadedFor !== householdId,
    live,
    refresh,
    changeQuantity,
    setQuantity,
    addItem,
    discardItem,
    removeItem,
    updateItem,
    setItemNutrition,
    setItemCategory,
    undoEvent,
  };

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

// ---------------------------------------------------------------------------
// The hook screens use: `const { items, changeQuantity } = usePantry();`
// ---------------------------------------------------------------------------
export function usePantry(): PantryContextValue {
  const value = useContext(PantryContext);
  if (value === null) {
    throw new Error("usePantry() must be used inside <PantryProvider>");
  }
  return value;
}

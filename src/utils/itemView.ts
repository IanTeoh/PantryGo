import { Storage } from "expo-sqlite/kv-store";

// How item pages show how much is left: a simple level bar (the default), or the
// container drawing you drag. Chosen in Profile → Features or during setup, kept on this phone.
export type ItemView = "simple" | "drawing";
const KEY = "pantrygo.itemView";

export function readItemView(): ItemView {
  try {
    return Storage.getItemSync(KEY) === "drawing" ? "drawing" : "simple";
  } catch {
    return "simple";
  }
}

export function saveItemView(view: ItemView) {
  try {
    Storage.setItemSync(KEY, view);
  } catch {
    // not remembered this time: fine
  }
}

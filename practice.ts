// practice.ts — run with:  node practice.ts
// A scratch file for practising JavaScript/TypeScript. Not part of the app.

// The shape of one pantry item (same as src/types.ts)
type Item = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: "pantry" | "fridge" | "freezer";
};

const items: Item[] = [
  { id: "1", name: "Rice", quantity: 2, unit: "kg", location: "pantry" },
  { id: "2", name: "Milk", quantity: 1, unit: "L", location: "fridge" },
  { id: "3", name: "Eggs", quantity: 10, unit: "pcs", location: "fridge" },
  { id: "4", name: "Frozen peas", quantity: 1, unit: "pack", location: "freezer" },
];

// ---------- Exercise 1: a function that returns true/false ----------
function isExpiringSoon(days: number): boolean {
  return days >= 0 && days <= 3;
}

console.log("--- Exercise 1 ---");
console.log(isExpiringSoon(2));   // true
console.log(isExpiringSoon(10));  // false
console.log(isExpiringSoon(-1));  // false (already expired, not "soon")

// ---------- Exercise 2: filter, then map ----------
const fridgeItems = items.filter((item) => item.location === "fridge");
const fridgeNames = fridgeItems.map((item) => item.name);

console.log("--- Exercise 2 ---");
console.log(fridgeNames);  // [ 'Milk', 'Eggs' ]

// ---------- Exercise 3: find, then copy with spread ----------
const eggs = items.find((item) => item.id === "3");

console.log("--- Exercise 3 ---");
if (eggs) {
  const usedUpEggs = { ...eggs, quantity: 0 };
  console.log("original:", eggs);        // quantity: 10  (unchanged)
  console.log("copy:    ", usedUpEggs);  // quantity: 0
  console.log("same object?", eggs === usedUpEggs);  // false
}

// ---------- Exercise 4: sort a copy by name ----------
const byName = [...items].sort((a, b) => a.name.localeCompare(b.name));

console.log("--- Exercise 4 ---");
console.log(byName.map((item) => item.name));  // [ 'Eggs', 'Frozen peas', 'Milk', 'Rice' ]
console.log(items.map((item) => item.name));   // original order: [ 'Rice', 'Milk', 'Eggs', 'Frozen peas' ]

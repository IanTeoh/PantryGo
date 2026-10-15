// Looks up a barcode in Open Food Facts: a free, open database of food products
// (https://world.openfoodfacts.org). No account or key is needed to read it.
// They ask apps to (1) say who they are with a User-Agent, and (2) stay under
// 15 lookups a minute per phone, which scanning groceries never gets near.

import type { Nutrition } from "@/types";

// Change the part in brackets to a way to contact you (e.g. your GitHub page or email)
const USER_AGENT = "PantryGo/1.0 (personal project)";

export type ProductInfo = {
  name: string;
  brand: string | null;
  quantity: number | null; // pack size, e.g. 2
  unit: string | null; // in PantryGo's units: "g" or "ml"
  nutrition: Nutrition | null; // per 100 g (or 100 ml for drinks), from the label
};

// Some scanners report UPC-A barcodes with 12 digits and some with a leading 0 (13 digits).
// Always use 13, so the same product is always the same barcode.
export function normaliseBarcode(code: string): string {
  const digits = code.replace(/\D/g, ""); // keep digits only
  return digits.length === 12 ? `0${digits}` : digits;
}

// Returns the product, or null if the database doesn't know it.
// Throws if the lookup itself fails (e.g. no internet).
export async function lookupBarcode(code: string): Promise<ProductInfo | null> {
  const fields =
    "product_name,product_name_en,brands,quantity,product_quantity,product_quantity_unit,nutriments";
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;

  // Give up after 8 seconds rather than leaving the person waiting
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (response.status === 404) return null; // not in the database
    if (!response.ok) throw new Error(`Open Food Facts replied ${response.status}`);

    const json = await response.json();
    const product = json?.product;
    if (json?.status !== 1 || !product) return null;

    const name = String(product.product_name || product.product_name_en || "").trim();
    if (!name) return null; // a barcode with no name isn't much help

    const size = readSize(product);
    return {
      name,
      brand: product.brands ? String(product.brands).split(",")[0].trim() : null, // first brand only
      quantity: size?.quantity ?? null,
      unit: size?.unit ?? null,
      // Only useful if we know the size in g/ml: "per 100 g" doesn't fit an item counted in "pcs"
      nutrition: size ? readNutrition(product.nutriments) : null,
    };
  } finally {
    clearTimeout(timeout); // runs whether it worked or not
  }
}

// Work out the pack size: from the separate number + unit fields if they're there,
// otherwise from the text, e.g. "2 L", "400g", "6 x 330 ml" (finds the "330 ml").
function readSize(product: Record<string, unknown>): { quantity: number; unit: string } | null {
  const fromFields = toPantryUnit(
    Number(product.product_quantity),
    String(product.product_quantity_unit ?? ""),
  );
  if (fromFields) return fromFields;

  const text = String(product.quantity ?? "");
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i);
  if (!match) return null;
  return toPantryUnit(Number(match[1].replace(",", ".")), match[2]);
}

function toPantryUnit(quantity: number, unit: string): { quantity: number; unit: string } | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  switch (unit.toLowerCase()) {
    case "g":
      return { quantity, unit: "g" };
    case "kg":
      return { quantity: quantity * 1000, unit: "g" }; // stored in g, shown as kg
    case "ml":
      return { quantity, unit: "ml" };
    case "cl":
      return { quantity: quantity * 10, unit: "ml" }; // 33 cl = 330 ml
    case "l":
      return { quantity: quantity * 1000, unit: "ml" }; // stored in ml, shown as L
    default:
      return null;
  }
}

// The label values per 100 g / 100 ml. Open Food Facts calls them e.g. "energy-kcal_100g".
function readNutrition(nutriments: unknown): Nutrition | null {
  if (!nutriments || typeof nutriments !== "object") return null;
  const n = nutriments as Record<string, unknown>;
  const value = (key: string): number | null => {
    const v = Number(n[`${key}_100g`]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null;
  };
  // Some products only list kilojoules: 1 kcal = 4.184 kJ
  const kj = value("energy-kj") ?? value("energy");
  const kcal = value("energy-kcal") ?? (kj !== null ? Math.round(kj / 4.184) : null);
  if (kcal === null) return null;
  return { kcal, protein: value("proteins"), carbs: value("carbohydrates"), fat: value("fat") };
}

import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ExpiryPicker } from "@/components/ExpiryPicker";
import { EstimateBanner } from "@/components/EstimateBanner";
import { FilterChips } from "@/components/FilterChips";
import { SplitPicker } from "@/components/SplitPicker";
import { NutritionFields } from "@/components/NutritionFields";
import { LOCATION_OPTIONS, UNIT_OPTIONS } from "@/data/formOptions";
import { useBudget } from "@/state/BudgetContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { ContainerType, Item, Location } from "@/types";
import { addDays } from "@/utils/dates";
import { lookupBarcode, normaliseBarcode } from "@/utils/openFoodFacts";
import {
  EMPTY_NUTRITION_TEXT,
  nutritionBasis,
  nutritionToText,
  parseNutrition,
  type NutritionText,
} from "@/utils/nutrition";
import { guessLocation } from "@/utils/stock";
import { CONTAINER_OPTIONS, formatAmount, guessContainer } from "@/utils/units";

// What happened with the last scan. Each "kind" carries the extra info it needs.
// (This is a "discriminated union": TypeScript knows `existing` only exists when kind is "existing".)
type ScanResult =
  | { kind: "none" }
  | { kind: "looking" }
  | { kind: "existing"; existing: Item } // already in your pantry
  | { kind: "found"; brand: string | null } // Open Food Facts knew it
  | { kind: "unknown" } // nobody knows it yet
  | { kind: "error" }; // couldn't look it up

export default function AddItemScreen() {
  // Opened with ?scan=1 (from a Scan button)? Then start with the camera open.
  const params = useLocalSearchParams<{ scan?: string }>();
  const { items, addItem, changeQuantity } = usePantry();
  const { addPurchase } = useBudget();
  const { household, members } = useHousehold();
  const spendingOn = household?.spendingEnabled !== false; // the household can turn spending off

  // ---- One piece of state per field: these are "controlled inputs" ----
  const [name, setName] = useState("");
  const [quantityText, setQuantityText] = useState("1"); // kept as text while typing
  const [unit, setUnit] = useState("pcs");
  const [location, setLocation] = useState<Location>("fridge");
  // "YYYY-MM-DD", or null for no date. Starts a week from today.
  const [expiry, setExpiry] = useState<string | null>(addDays(7));
  // null = "pick for me" (guessed from the unit). Set once the person taps a shape.
  const [containerChoice, setContainerChoice] = useState<ContainerType | null>(null);
  const [priceText, setPriceText] = useState(""); // optional: what it cost
  // Who the price is split between: everyone to start with
  const [splitWith, setSplitWith] = useState<string[]>(() => members.map((m) => m.userId));
  // Optional calories etc. (filled in for you when a scan finds them)
  const [nutritionText, setNutritionText] = useState<NutritionText>(EMPTY_NUTRITION_TEXT);

  // ---- Scanning ----
  const [scanning, setScanning] = useState(params.scan === "1");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult>({ kind: "none" });

  // ---- Derived values: worked out from the fields on every render ----
  const trimmedName = name.trim();
  const quantity = Number(quantityText.replace(",", ".")); // allow "1,5" as well as "1.5"
  const quantityOk = Number.isFinite(quantity) && quantity > 0;
  const container = containerChoice ?? guessContainer(unit); // ?? = "if null, use this instead"
  const price = Number(priceText.replace(",", ".").replace("$", ""));
  const hasPrice = priceText.trim() !== "" && Number.isFinite(price) && price > 0;
  const nutrition = parseNutrition(nutritionText);
  const canSave = trimmedName.length > 0 && quantityOk && nutrition.ok;

  // Cancel: if you came here just to scan (a Scan button) and haven't scanned
  // anything yet, go back to wherever you were. Otherwise show the form.
  function cancelScan() {
    if (params.scan === "1" && barcode === null && router.canGoBack()) {
      router.back();
    } else {
      setScanning(false);
    }
  }

  // Called by the scanner with the barcode's digits
  async function handleScanned(raw: string) {
    setScanning(false);
    const code = normaliseBarcode(raw);
    setBarcode(code);

    // 1. Has this household scanned it before? Then we already know everything about it.
    const existing = items.find((it) => it.barcode === code);
    if (existing) {
      setName(existing.name);
      setQuantityText(String(existing.capacity)); // a new one is a full pack
      setUnit(existing.unit);
      setContainerChoice(existing.container);
      setLocation(existing.location);
      setNutritionText(nutritionToText(existing.nutrition));
      setScan({ kind: "existing", existing });
      return;
    }

    // 2. Otherwise ask Open Food Facts
    setScan({ kind: "looking" });
    try {
      const product = await lookupBarcode(code);
      if (!product) {
        setScan({ kind: "unknown" });
        return;
      }
      setName(product.name);
      if (product.quantity !== null && product.unit !== null) {
        setQuantityText(String(product.quantity));
        setUnit(product.unit);
      }
      setLocation(guessLocation(product.name));
      setNutritionText(nutritionToText(product.nutrition)); // per 100 g/ml, from the label
      setScan({ kind: "found", brand: product.brand });
    } catch {
      setScan({ kind: "error" });
    }
  }

  function save() {
    if (!canSave) return;
    // A new item starts full, so its capacity is the amount you have now.
    // The barcode is saved with it, so next time it's recognised instantly.
    addItem({
      name: trimmedName,
      quantity,
      capacity: quantity,
      unit,
      container,
      location,
      expiry,
      barcode,
      nutrition: nutrition.ok ? nutrition.value : null,
    });
    // If a price was given, record it as spending (paid by you)
    if (spendingOn && hasPrice) {
      addPurchase({
        description: trimmedName,
        amount: price,
        splitWith,
        source: "item",
      });
    }
    router.back(); // close the form and return to where we came from
  }

  // Scanned something you already have: add another full pack to it instead
  function topUpExisting(existing: Item) {
    changeQuantity(existing.id, existing.capacity);
    router.back();
  }

  // While scanning, the camera takes over the whole screen
  if (scanning) {
    return <BarcodeScanner onScanned={handleScanned} onCancel={cancelScan} />;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" // let taps on chips/buttons work while the keyboard is open
      automaticallyAdjustKeyboardInsets // iOS: scroll so the keyboard doesn't cover fields
    >
      {/* Scan */}
      <View style={styles.padded}>
        <Pressable
          onPress={() => setScanning(true)}
          style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          <Text style={styles.scanText}>{barcode ? "Scan again" : "Scan a barcode"}</Text>
        </Pressable>
      </View>

      {/* What the scan found */}
      <ScanBanner scan={scan} onTopUp={topUpExisting} />

      {/* Name */}
      <View style={styles.field}>
        <Text style={styles.label}>What is it?</Text>
        <TextInput
          value={name} // the box shows whatever is in state…
          onChangeText={setName} // …and every keystroke updates state
          placeholder="e.g. Olive oil"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
      </View>

      {/* Quantity + unit */}
      <View style={styles.field}>
        <Text style={styles.label}>How much?</Text>
        <TextInput
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="decimal-pad"
          style={[styles.input, styles.quantityInput, !quantityOk && styles.inputError]}
          selectTextOnFocus
        />
        {!quantityOk && <Text style={styles.error}>Enter a number above 0</Text>}
      </View>
      <FilterChips options={UNIT_OPTIONS} selected={unit} onSelect={setUnit} />

      {/* Shape: what the item's detail page draws */}
      <Text style={[styles.label, styles.padded]}>Shape</Text>
      <FilterChips options={CONTAINER_OPTIONS} selected={container} onSelect={setContainerChoice} />

      {/* Location */}
      <Text style={[styles.label, styles.padded]}>Where does it live?</Text>
      <FilterChips options={LOCATION_OPTIONS} selected={location} onSelect={setLocation} />

      {/* Expiry */}
      <Text style={[styles.label, styles.padded]}>Use by</Text>
      <ExpiryPicker value={expiry} onChange={setExpiry} />

      {/* Nutrition (optional): lets you log calories when you eat it */}
      <Text style={[styles.label, styles.padded]}>Nutrition (optional)</Text>
      {/* Boxes still empty? Offer an estimate from the common foods list */}
      {nutritionText.kcal.trim() === "" && (
        <EstimateBanner
          name={name}
          unit={unit}
          onUse={(n) => setNutritionText(nutritionToText(n))}
        />
      )}
      <NutritionFields
        value={nutritionText}
        onChange={setNutritionText}
        basisLabel={nutritionBasis(unit).label}
        invalid={!nutrition.ok}
      />

      {/* Price (optional): recorded as spending (only if the household uses spending) */}
      {spendingOn && (
        <View style={styles.field}>
          <Text style={styles.label}>Price (optional)</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="$0.00"
            placeholderTextColor={colors.textSoft}
            keyboardType="decimal-pad"
            style={[styles.input, styles.quantityInput]}
          />
        </View>
      )}
      {/* Who's it for? (who the price is split between) */}
      {spendingOn && (
        <SplitPicker
          selected={splitWith}
          onChange={setSplitWith}
          amount={hasPrice ? price : undefined}
        />
      )}

      {/* Save */}
      <Pressable
        onPress={save}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && styles.saveDisabled,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>{trimmedName ? `Add ${trimmedName}` : "Add item"}</Text>
      </Pressable>
    </ScrollView>
  );
}

// The message under the scan button. One small component, a different message per result.
function ScanBanner({ scan, onTopUp }: { scan: ScanResult; onTopUp: (item: Item) => void }) {
  switch (scan.kind) {
    case "none":
      return null;
    case "looking":
      return <Banner icon={<ActivityIndicator color={colors.primary} />} text="Looking it up…" />;
    case "existing": {
      const it = scan.existing;
      return (
        <Banner
          icon={<Ionicons name="home-outline" size={20} color={colors.primary} />}
          text={`Already in your pantry: ${it.name}, ${formatAmount(it.quantity, it.unit)} left. Top it up, or add this one separately below.`}
        >
          <Pressable onPress={() => onTopUp(it)} style={styles.bannerButton}>
            <Text style={styles.bannerButtonText}>
              Top up by {formatAmount(it.capacity, it.unit)}
            </Text>
          </Pressable>
        </Banner>
      );
    }
    case "found":
      return (
        <Banner
          icon={<Ionicons name="checkmark-circle" size={20} color={colors.fresh} />}
          text={`Found${scan.brand ? ` (${scan.brand})` : ""}. Check the details, add a use-by date, and save.`}
        />
      );
    case "unknown":
      return (
        <Banner
          icon={<Ionicons name="help-circle-outline" size={20} color={colors.soon} />}
          text="This one isn't in the database yet. Type its name and size: PantryGo will remember this barcode for your household next time."
        />
      );
    case "error":
      return (
        <Banner
          icon={<Ionicons name="cloud-offline-outline" size={20} color={colors.urgent} />}
          text="Couldn't look it up. Check your internet connection, or type it in."
        />
      );
  }
}

function Banner({
  icon,
  text,
  children,
}: {
  icon: React.ReactNode;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerRow}>
        {icon}
        <Text style={styles.bannerText}>{text}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  field: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  quantityInput: { width: 120 },
  inputError: { borderColor: colors.urgent },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
  },
  scanText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primary },
  banner: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  bannerText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  bannerButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bannerButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
  saveButton: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

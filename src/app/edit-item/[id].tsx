import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ExpiryPicker } from "@/components/ExpiryPicker";
import { EstimateBanner } from "@/components/EstimateBanner";
import { FilterChips } from "@/components/FilterChips";
import { NutritionFields } from "@/components/NutritionFields";
import { LOCATION_OPTIONS, UNIT_OPTIONS } from "@/data/formOptions";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { ContainerType, Item, Location } from "@/types";
import {
  nutritionBasis,
  nutritionToText,
  parseNutrition,
  type NutritionText,
} from "@/utils/nutrition";
import { CONTAINER_OPTIONS, formatAmount } from "@/utils/units";

// /edit-item/8 → edit item 8. Opened from the Edit button on an item's page.
export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items } = usePantry();
  const item = items.find((it) => it.id === id);

  if (!item) {
    return (
      <View style={styles.missing}>
        <Text style={styles.hint}>This item isn't in your pantry any more.</Text>
      </View>
    );
  }

  // `key`: if a different item is ever shown here, start the form afresh
  return <EditForm key={item.id} item={item} />;
}

// The form is its own component so its useState calls can start from the item's
// current values. (useState only uses its starting value the first time.)
function EditForm({ item }: { item: Item }) {
  const { updateItem, setItemNutrition } = usePantry();

  // ---- Fields, starting from the item as it is now ----
  const [name, setName] = useState(item.name);
  const [capacityText, setCapacityText] = useState(String(item.capacity));
  const [unit, setUnit] = useState(item.unit);
  const [container, setContainer] = useState<ContainerType>(item.container);
  const [location, setLocation] = useState<Location>(item.location);
  // "YYYY-MM-DD", or null for no date
  const [expiry, setExpiry] = useState<string | null>(item.expiry);
  const startNutrition = nutritionToText(item.nutrition);
  const [nutritionText, setNutritionText] = useState<NutritionText>(startNutrition);

  // ---- Derived ----
  const trimmedName = name.trim();
  const capacity = Number(capacityText.replace(",", "."));
  const capacityOk = Number.isFinite(capacity) && capacity > 0;
  const nutrition = parseNutrition(nutritionText);
  const canSave = trimmedName.length > 0 && capacityOk && nutrition.ok;
  // Only send nutrition if a box was actually changed
  const nutritionChanged = JSON.stringify(nutritionText) !== JSON.stringify(startNutrition);

  function save() {
    if (!canSave) return;
    updateItem(item.id, { name: trimmedName, unit, container, location, expiry, capacity });
    if (nutritionChanged && nutrition.ok) setItemNutrition(item.id, nutrition.value);
    router.back();
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          autoCapitalize="sentences"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Full size</Text>
        <Text style={styles.hint}>How much a full one holds, so the fill level is right.</Text>
        <TextInput
          value={capacityText}
          onChangeText={setCapacityText}
          keyboardType="decimal-pad"
          style={[styles.input, styles.numberInput, !capacityOk && styles.inputError]}
          selectTextOnFocus
        />
        {!capacityOk && <Text style={styles.error}>Enter a number above 0</Text>}
        {capacityOk && capacity < item.quantity && (
          <Text style={styles.hint}>
            You have {formatAmount(item.quantity, item.unit)} left, so full will be at least that.
          </Text>
        )}
      </View>
      <FilterChips options={UNIT_OPTIONS} selected={unit} onSelect={setUnit} />

      <Text style={[styles.label, styles.padded]}>Shape</Text>
      <FilterChips options={CONTAINER_OPTIONS} selected={container} onSelect={setContainer} />

      <Text style={[styles.label, styles.padded]}>Where does it live?</Text>
      <FilterChips options={LOCATION_OPTIONS} selected={location} onSelect={setLocation} />

      <Text style={[styles.label, styles.padded]}>Use by</Text>
      <ExpiryPicker value={expiry} onChange={setExpiry} />

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

      <Text style={[styles.hint, styles.padded, styles.note]}>
        To change how much is left ({formatAmount(item.quantity, item.unit)}), use the item's page,
        so it's recorded in the history.
      </Text>

      <Pressable
        onPress={save}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>Save changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  note: { marginTop: spacing.sm },
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
  numberInput: { width: 120 },
  inputError: { borderColor: colors.urgent },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent },
  saveButton: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

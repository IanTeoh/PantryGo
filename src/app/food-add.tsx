import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TextInput } from "@/components/TextInput";

import { FilterChips } from "@/components/FilterChips";
import { FoodIcon } from "@/components/FoodIcon";
import { NutritionFields } from "@/components/NutritionFields";
import type { CommonFood } from "@/data/commonFoods";
import { useNutrition, type FoodEntry, type SavedFood } from "@/state/NutritionContext";
import { usePantry } from "@/state/PantryContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { Item } from "@/types";
import { formatDate, toIsoDate } from "@/utils/dates";
import { success, tap } from "@/utils/haptics";
import {
  EMPTY_NUTRITION_TEXT,
  formatGrams,
  formatKcal,
  nutritionBasis,
  nutritionFor,
  nutritionToText,
  parseNutrition,
  type NutritionText,
} from "@/utils/nutrition";
import {
  defaultPortion,
  estimateForItem,
  macrosForAmount,
  portionsFor,
  searchFoods,
  searchHistory,
} from "@/utils/foodMatch";
import { formatAmount } from "@/utils/units";

// Opened from the Calories page. ?day=2026-10-09 logs it to that day (default: today).
export default function FoodAddScreen() {
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? toIsoDate(new Date());
  const isToday = day === toIsoDate(new Date());

  const [mode, setMode] = useState<"pantry" | "other" | "saved">("pantry");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {!isToday && <Text style={[styles.hint, styles.padded]}>Adding to {formatDate(day)}</Text>}
      <FilterChips
        options={[
          { value: "pantry", label: "From the pantry" },
          { value: "other", label: "Other food" },
          { value: "saved", label: "My foods" },
        ]}
        selected={mode}
        onSelect={setMode}
      />
      {/* Two different forms. `key` isn't needed: each is its own component with its own state. */}
      {mode === "pantry" ? (
        <FromPantry day={day} isToday={isToday} />
      ) : mode === "other" ? (
        <OtherFood day={day} />
      ) : (
        <MyFoods day={day} />
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// From the pantry: pick an item, say how much, and it works out the calories
// ---------------------------------------------------------------------------
function FromPantry({ day, isToday }: { day: string; isToday: boolean }) {
  const { items, setQuantity, setItemNutrition } = usePantry();
  const { logFood } = useNutrition();

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [amountText, setAmountText] = useState("");
  const [nutritionText, setNutritionText] = useState<NutritionText>(EMPTY_NUTRITION_TEXT);
  const [takeOut, setTakeOut] = useState(isToday); // also use it up in the pantry?
  // When the item had no nutrition: which common food the boxes were estimated from
  const [estimatedFrom, setEstimatedFrom] = useState<string | null>(null);

  // ---- Picking ----
  if (picked === null) {
    const q = search.trim().toLowerCase();
    const choices = items
      .filter((it) => it.quantity > 0 && it.name.toLowerCase().includes(q))
      // things with calories already known first, then A–Z
      .sort(
        (a, b) => Number(!!b.nutrition) - Number(!!a.nutrition) || a.name.localeCompare(b.name),
      );

    return (
      <View style={styles.section}>
        <View style={styles.padded}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your pantry"
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            autoFocus
          />
        </View>
        <View style={[styles.list, styles.paddedMargin]}>
          {choices.length === 0 ? (
            <Text style={[styles.hint, { padding: spacing.md }]}>
              Nothing matches. Try "Other food" instead.
            </Text>
          ) : (
            choices.map((it, i) => (
              <Pressable
                key={it.id}
                onPress={() => {
                  tap();
                  setPicked(it);
                  setAmountText(defaultAmount(it.unit));
                  // No calories on the item yet? Start from an estimate (editable below)
                  const estimate = it.nutrition ? null : estimateForItem(it.name, it.unit);
                  setNutritionText(nutritionToText(estimate?.nutrition));
                  setEstimatedFrom(estimate?.food.name ?? null);
                }}
                style={({ pressed }) => [
                  styles.choice,
                  i > 0 && styles.divider,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <FoodIcon
                  name={it.name}
                  container={it.container}
                  location={it.location}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceName}>{it.name}</Text>
                  <Text style={styles.hint}>
                    {formatAmount(it.quantity, it.unit)} left
                    {it.nutrition
                      ? ` · ${formatKcal(it.nutrition.kcal)} kcal ${nutritionBasis(it.unit).label}`
                      : " · calories not set yet"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    );
  }

  // ---- Picked: how much? ----
  const basis = nutritionBasis(picked.unit);
  const amount = Number(amountText.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0;
  // Use the item's own nutrition, or what's typed below if it doesn't have any yet
  const typed = parseNutrition(nutritionText);
  const nutrition = picked.nutrition ?? (typed.ok ? typed.value : null);
  const macros = nutrition && amountOk ? nutritionFor(nutrition, amount, picked.unit) : null;
  const canLog = macros !== null;

  function log() {
    if (!picked || !macros || !nutrition) return;
    success();
    // Typed in new values? Save them on the item so next time they're already there
    if (!picked.nutrition) setItemNutrition(picked.id, nutrition);
    logFood({
      day,
      name: picked.name,
      amount,
      unit: picked.unit,
      ...macros, // kcal, protein, carbs, fat
      itemId: picked.id,
    });
    if (takeOut) setQuantity(picked.id, picked.quantity - amount); // never goes below 0
    router.back();
  }

  return (
    <View style={styles.section}>
      {/* The chosen item */}
      <View style={[styles.pickedCard, styles.paddedMargin]}>
        <FoodIcon
          name={picked.name}
          container={picked.container}
          location={picked.location}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.choiceName}>{picked.name}</Text>
          <Text style={styles.hint}>{formatAmount(picked.quantity, picked.unit)} left</Text>
        </View>
        <Pressable onPress={() => setPicked(null)} hitSlop={8}>
          <Text style={styles.link}>Change</Text>
        </Pressable>
      </View>

      {/* How much */}
      <View style={styles.field}>
        <Text style={styles.label}>How much did you have?</Text>
        <View style={styles.amountRow}>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            style={[styles.input, styles.amountInput, !amountOk && styles.inputError]}
            selectTextOnFocus
          />
          <Text style={styles.unitText}>{picked.unit}</Text>
        </View>
      </View>
      <FilterChips
        options={quickAmounts(picked.unit).map((a) => ({
          value: String(a),
          label: formatAmount(a, picked.unit),
        }))}
        selected={amountText}
        onSelect={setAmountText}
      />

      {/* No nutrition on this item yet: ask for it once */}
      {!picked.nutrition && (
        <>
          <Text style={[styles.label, styles.padded]}>
            {estimatedFrom ? "Nutrition (estimated)" : "Nutrition (from the label)"}
          </Text>
          <NutritionFields
            value={nutritionText}
            onChange={setNutritionText}
            basisLabel={basis.label}
            invalid={!typed.ok}
          />
          <Text style={[styles.hint, styles.padded]}>
            {estimatedFrom
              ? `Typical values for "${estimatedFrom}". Change them to match the label if you have it. `
              : ""}
            Saved on the item, so you only do this once.
          </Text>
        </>
      )}

      {/* Result */}
      {macros && (
        <View style={[styles.result, styles.paddedMargin]}>
          <Text style={styles.resultKcal}>{formatKcal(macros.kcal)} kcal</Text>
          <Text style={styles.hint}>
            Protein {formatGrams(macros.protein)} · Carbs {formatGrams(macros.carbs)} · Fat{" "}
            {formatGrams(macros.fat)}
          </Text>
        </View>
      )}

      {/* Also use it up? */}
      <Pressable
        onPress={() => {
          tap();
          setTakeOut((t) => !t);
        }}
        style={[styles.toggleRow, styles.paddedMargin]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: takeOut }}
      >
        <Ionicons
          name={takeOut ? "checkbox" : "square-outline"}
          size={22}
          color={takeOut ? colors.primary : colors.textSoft}
        />
        <Text style={styles.toggleText}>
          Also take {amountOk ? formatAmount(Math.min(amount, picked.quantity), picked.unit) : "it"}{" "}
          out of the pantry
        </Text>
      </Pressable>

      <Pressable
        onPress={log}
        disabled={!canLog}
        style={({ pressed }) => [
          styles.saveButton,
          !canLog && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>Log it</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Other food: anything not from the pantry (takeaway, lunch at uni…)
// ---------------------------------------------------------------------------
function OtherFood({ day }: { day: string }) {
  const { logFood, entries, saveFood } = useNutrition();
  const [alsoSave, setAlsoSave] = useState(false); // also keep it in My foods
  const [name, setName] = useState("");
  const [nutritionText, setNutritionText] = useState<NutritionText>(EMPTY_NUTRITION_TEXT);
  // A common food picked from the suggestions, and how much of it (g or ml)
  const [food, setFood] = useState<CommonFood | null>(null);
  const [amountText, setAmountText] = useState("");
  const [fromHistory, setFromHistory] = useState(false);

  const parsed = parseNutrition(nutritionText);
  const n = parsed.ok ? parsed.value : null;
  const canLog = name.trim().length > 0 && n !== null;
  const amount = Number(amountText.replace(",", "."));
  const amountOk = Number.isFinite(amount) && amount > 0;

  // Suggestions: only while nothing has been chosen or typed into the numbers yet
  const showSuggestions =
    food === null && !fromHistory && nutritionText.kcal === "" && name.trim().length >= 2;
  const pastMatches = showSuggestions ? searchHistory(entries, name, 3) : [];
  const foodMatches = showSuggestions
    ? searchFoods(name, "meal", 8)
        // not foods as they're stored (dry pasta, raw chicken): you ate it cooked
        .filter((m) => m.score >= 50 && m.food.prefer !== "pantry")
        .slice(0, 6)
    : [];

  // Fill the boxes from a food and an amount. They stay editable afterwards.
  function fillFrom(f: CommonFood, grams: number) {
    setNutritionText(nutritionToText(macrosForAmount(f, grams)));
  }

  function pickFood(f: CommonFood) {
    tap();
    const first = defaultPortion(f, name);
    setFood(f);
    setAmountText(String(first.amount));
    fillFrom(f, first.amount);
    // Keep a descriptive name ("Butter chicken from Spice Hut"); replace a half-typed one ("piz")
    const [top] = searchFoods(name, "meal", 1);
    if (!(top?.food === f && top.score >= 70)) setName(f.name);
  }

  function pickPast(e: FoodEntry) {
    tap();
    setFromHistory(true);
    setName(e.name);
    setNutritionText(
      nutritionToText({ kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }),
    );
  }

  function changeAmount(text: string) {
    setAmountText(text);
    const grams = Number(text.replace(",", "."));
    if (food && Number.isFinite(grams) && grams > 0) fillFrom(food, grams);
  }

  function startOver() {
    tap();
    setFood(null);
    setFromHistory(false);
    setAmountText("");
    setNutritionText(EMPTY_NUTRITION_TEXT);
  }

  function log() {
    if (!n || !canLog) return;
    success();
    logFood({
      day,
      name: name.trim(),
      amount: food && amountOk ? amount : null,
      unit: food && amountOk ? food.basis : null,
      kcal: n.kcal,
      protein: n.protein ?? 0,
      carbs: n.carbs ?? 0,
      fat: n.fat ?? 0,
      itemId: null,
    });
    if (alsoSave) {
      // Saved as one serving of what you just had
      saveFood({
        name: name.trim(),
        serving: food && amountOk ? `${amount} ${food.basis}` : null,
        kcal: n.kcal,
        protein: n.protein ?? 0,
        carbs: n.carbs ?? 0,
        fat: n.fat ?? 0,
      });
    }
    router.back();
  }

  return (
    <View style={styles.section}>
      <View style={styles.field}>
        <Text style={styles.label}>What was it?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Chicken wrap"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          autoCapitalize="sentences"
          autoFocus
        />
      </View>

      {/* ---- Suggestions while typing ---- */}
      {(pastMatches.length > 0 || foodMatches.length > 0) && (
        <View style={[styles.list, styles.paddedMargin]}>
          {pastMatches.map((e, i) => (
            <Pressable
              key={`past-${e.id}`}
              onPress={() => pickPast(e)}
              style={({ pressed }) => [
                styles.choice,
                i > 0 && styles.divider,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceName}>{e.name}</Text>
                <Text style={styles.hint}>You had this before</Text>
              </View>
              <Text style={styles.choiceKcal}>{formatKcal(e.kcal)} kcal</Text>
            </Pressable>
          ))}
          {foodMatches.map(({ food: f }, i) => {
            const first = defaultPortion(f, name);
            return (
              <Pressable
                key={f.name}
                onPress={() => pickFood(f)}
                style={({ pressed }) => [
                  styles.choice,
                  (i > 0 || pastMatches.length > 0) && styles.divider,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceName}>{f.name}</Text>
                  <Text style={styles.hint}>{first.label}</Text>
                </View>
                <Text style={styles.choiceKcal}>
                  ~{formatKcal(macrosForAmount(f, first.amount).kcal)} kcal
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ---- Picked a common food: how much? ---- */}
      {food && (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>How much?</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={amountText}
                onChangeText={changeAmount}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput, !amountOk && styles.inputError]}
                selectTextOnFocus
              />
              <Text style={styles.unitText}>{food.basis}</Text>
            </View>
          </View>
          <FilterChips
            options={portionsFor(food).flatMap((p) => [
              { value: String(p.amount), label: p.label },
              // and two of the typical serve ("2 slices")
              ...(!food.sized && p === portionsFor(food)[0] && food.portion
                ? [{ value: String(p.amount * 2), label: `×2 (${p.amount * 2} ${food.basis})` }]
                : []),
            ])}
            selected={amountText}
            onSelect={changeAmount}
          />
        </>
      )}

      <View style={[styles.labelRow, styles.padded]}>
        <Text style={styles.label}>
          {food ? "Nutrition (estimated)" : fromHistory ? "Nutrition (last time)" : "Nutrition"}
        </Text>
        {(food || fromHistory) && (
          <Pressable onPress={startOver} hitSlop={8}>
            <Text style={styles.link}>Clear</Text>
          </Pressable>
        )}
      </View>
      <NutritionFields
        value={nutritionText}
        onChange={setNutritionText}
        basisLabel="for what you ate"
        invalid={!parsed.ok}
      />
      <Text style={[styles.hint, styles.padded]}>
        {food
          ? food.sized
            ? `A typical ${food.name.toLowerCase()} as it's usually served. Pick Small or Large if yours was, and adjust anything that looks off.`
            : `Typical values for ${food.name.toLowerCase()}. Real portions vary, so adjust anything that looks off.`
          : "Start typing for suggestions, or enter the numbers yourself. Only calories are needed."}
      </Text>
      <Pressable
        onPress={() => {
          tap();
          setAlsoSave((v) => !v);
        }}
        style={[styles.toggleRow, styles.paddedMargin]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: alsoSave }}
      >
        <Ionicons
          name={alsoSave ? "checkbox" : "square-outline"}
          size={22}
          color={alsoSave ? colors.primary : colors.textSoft}
        />
        <Text style={styles.toggleText}>Save to My foods, to log it in one tap next time</Text>
      </Pressable>
      <Pressable
        onPress={log}
        disabled={!canLog}
        style={({ pressed }) => [
          styles.saveButton,
          !canLog && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>Log it</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// My foods: things you eat often (your breakfast shake, a Subway sandwich…),
// saved with their calories. Tap one, choose how many, log it.
// ---------------------------------------------------------------------------
function MyFoods({ day }: { day: string }) {
  const { savedFoods, logSavedFood, deleteSavedFood, saveFood } = useNutrition();
  const [openId, setOpenId] = useState<string | null>(null); // the one being logged
  const [servings, setServings] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function choose(f: SavedFood) {
    tap();
    setConfirmDelete(null);
    setServings(1);
    setOpenId(openId === f.id ? null : f.id);
  }

  function log(f: SavedFood) {
    success();
    logSavedFood(f, servings, day);
    router.back();
  }

  function remove(f: SavedFood) {
    if (confirmDelete !== f.id) {
      setConfirmDelete(f.id); // first tap: ask
      return;
    }
    tap();
    setConfirmDelete(null);
    deleteSavedFood(f.id);
  }

  if (adding) {
    return (
      <NewSavedFood
        onCancel={() => setAdding(false)}
        onSave={async (food) => {
          const err = await saveFood(food);
          if (!err) setAdding(false);
          return err;
        }}
      />
    );
  }

  return (
    <View style={styles.section}>
      {savedFoods.length === 0 ? (
        <View style={[styles.result, styles.paddedMargin, { gap: spacing.sm }]}>
          <Text style={styles.choiceName}>Nothing saved yet</Text>
          <Text style={styles.hint}>
            Save things you eat often, like your breakfast shake, and log them in one tap.
          </Text>
        </View>
      ) : (
        <View style={[styles.list, styles.paddedMargin]}>
          {savedFoods.map((f, i) => {
            const isOpen = openId === f.id;
            return (
              <View key={f.id} style={i > 0 && styles.divider}>
                <Pressable
                  onPress={() => choose(f)}
                  style={({ pressed }) => [styles.choice, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Ionicons name="star" size={18} color={colors.soon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceName}>{f.name}</Text>
                    <Text style={styles.hint}>
                      {f.serving ? `${f.serving} · ` : ""}P {formatGrams(f.protein)} · C{" "}
                      {formatGrams(f.carbs)} · F {formatGrams(f.fat)}
                    </Text>
                  </View>
                  <Text style={styles.choiceKcal}>{formatKcal(f.kcal)} kcal</Text>
                </Pressable>
                {isOpen && (
                  <View style={styles.savedOpen}>
                    <View style={styles.amountRow}>
                      <Text style={[styles.label, { marginTop: 0, flex: 1 }]}>Servings</Text>
                      <Pressable
                        onPress={() => setServings((v) => Math.max(0.5, v - 0.5))}
                        style={styles.stepButton}
                        hitSlop={6}
                        accessibilityLabel="Fewer servings"
                      >
                        <Ionicons name="remove" size={18} color={colors.primary} />
                      </Pressable>
                      <Text style={styles.stepValue}>{servings}</Text>
                      <Pressable
                        onPress={() => setServings((v) => Math.min(20, v + 0.5))}
                        style={styles.stepButton}
                        hitSlop={6}
                        accessibilityLabel="More servings"
                      >
                        <Ionicons name="add" size={18} color={colors.primary} />
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => log(f)}
                      style={({ pressed }) => [
                        styles.saveButton,
                        styles.savedLog,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={styles.saveText}>
                        Log {formatKcal(Math.round(f.kcal * servings))} kcal
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => remove(f)} hitSlop={6} style={styles.savedDelete}>
                      <Text style={[styles.link, { color: colors.urgent }]}>
                        {confirmDelete === f.id
                          ? "Tap again to remove it from My foods"
                          : "Remove from My foods"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      <Pressable
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.addSaved, styles.paddedMargin, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.link}>New saved food</Text>
      </Pressable>
    </View>
  );
}

// Adding a saved food by hand: a name, an optional serving, and its calories
function NewSavedFood({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (food: Omit<SavedFood, "id" | "lastUsedAt">) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [nutritionText, setNutritionText] = useState<NutritionText>(EMPTY_NUTRITION_TEXT);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseNutrition(nutritionText);
  const n = parsed.ok ? parsed.value : null;
  const canSave = name.trim().length > 0 && n !== null;

  async function save() {
    if (!n || !canSave) return;
    const err = await onSave({
      name: name.trim(),
      serving: serving.trim() || null,
      kcal: n.kcal,
      protein: n.protein ?? 0,
      carbs: n.carbs ?? 0,
      fat: n.fat ?? 0,
    });
    if (err) setError(err);
    else success();
  }

  return (
    <View style={styles.section}>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. My breakfast shake"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          autoCapitalize="sentences"
          maxLength={80}
          autoFocus
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>One serving is… (optional)</Text>
        <TextInput
          value={serving}
          onChangeText={setServing}
          placeholder="e.g. 1 glass, 6-inch sub"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          maxLength={40}
        />
      </View>
      <Text style={[styles.label, styles.padded]}>Nutrition for one serving</Text>
      <NutritionFields
        value={nutritionText}
        onChange={setNutritionText}
        basisLabel="per serving"
        invalid={!parsed.ok}
      />
      <Text style={[styles.hint, styles.padded]}>Only calories are needed.</Text>
      {error && <Text style={[styles.error, styles.padded]}>{error}</Text>}
      <Pressable
        onPress={save}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.saveText}>Save to My foods</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.cancel} hitSlop={8}>
        <Text style={styles.hint}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// A sensible starting amount: 100 g/ml (like the label), 0.1 kg/L, or 1 of anything counted
function defaultAmount(unit: string): string {
  if (unit === "g" || unit === "ml") return "100";
  if (unit === "kg" || unit === "L") return "0.1";
  return "1";
}

function quickAmounts(unit: string): number[] {
  if (unit === "g") return [30, 50, 100, 200];
  if (unit === "ml") return [100, 200, 250, 500];
  if (unit === "kg" || unit === "L") return [0.1, 0.25, 0.5];
  return [1, 2, 3];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  section: { gap: spacing.md },
  padded: { paddingHorizontal: spacing.lg },
  paddedMargin: { marginHorizontal: spacing.lg },
  field: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
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
  inputError: { borderColor: colors.urgent },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  choiceKcal: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textSoft },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  choiceName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  pickedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  amountInput: { width: 120 },
  unitText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.textSoft },
  result: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  resultKcal: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  saveButton: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.urgent },
  cancel: { alignSelf: "center", padding: spacing.sm },
  savedOpen: { paddingBottom: spacing.md, gap: spacing.md },
  savedLog: { marginHorizontal: 0, marginTop: 0 },
  savedDelete: { alignSelf: "center" },
  addSaved: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: {
    minWidth: 32,
    textAlign: "center",
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
});

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

import { COVER_KEYS, RecipeCover } from "@/components/RecipeCover";
import { pickPhoto, uploadPhoto, type PickedPhoto } from "@/lib/photos";
import { useAuth } from "@/state/AuthContext";
import { useCommunity } from "@/state/CommunityContext";
import { useRecipes } from "@/state/RecipesContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { tick, warning } from "@/utils/haptics";
import { CUISINES, DIFFICULTIES, TAGS } from "@/utils/recipeMeta";
import {
  formatIngredient,
  parseIngredientLine,
  type CoverKey,
  type Difficulty,
  type Ingredient,
  type Recipe,
} from "@/utils/recipes";

// New recipe (/recipe-edit) or edit one (/recipe-edit?id=…)
export default function RecipeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { recipes } = useRecipes();
  const existing = id ? recipes.find((r) => r.id === id) : undefined;

  // `key`: start the form afresh for a different recipe (see the Edit item screen)
  return <RecipeForm key={existing?.id ?? "new"} existing={existing} />;
}

function RecipeForm({ existing }: { existing?: Recipe }) {
  const { addRecipe, updateRecipe } = useRecipes();
  const community = useCommunity();
  const { session } = useAuth();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [servingsText, setServingsText] = useState(
    existing?.servings ? String(existing.servings) : "",
  );
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? "");
  // Ingredients are edited as text, one per line, and read into structured data
  const [ingredientsText, setIngredientsText] = useState(
    existing ? existing.ingredients.map(formatIngredient).join("\n") : "",
  );
  const [steps, setSteps] = useState(existing?.steps ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [minutesText, setMinutesText] = useState(existing?.minutes ? String(existing.minutes) : "");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(existing?.difficulty ?? null);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [cover, setCover] = useState<CoverKey>(existing?.cover ?? "sage");
  const [cuisine, setCuisine] = useState<string | null>(existing?.cuisine ?? null);
  const [share, setShare] = useState(existing?.publishedId != null);
  // The photo: the saved one (a path), a newly picked one (not uploaded yet), or none
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null);
  const [picked, setPicked] = useState<PickedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sharing rules: you can share your own recipes, not copies of other people's,
  // and only the person who shared one can change or stop sharing it
  const sharedCopy = existing?.publishedId
    ? community.recipes.find((c) => c.id === existing.publishedId)
    : undefined;
  const sharedBySomeoneElse = sharedCopy !== undefined && sharedCopy.authorId !== session?.user.id;
  const isSavedCopy = existing?.savedFrom != null;
  const canChangeSharing = !isSavedCopy && !sharedBySomeoneElse;

  // ---- Derived ----
  const ingredients = ingredientsText
    .split("\n")
    .map(parseIngredientLine)
    .filter((i): i is Ingredient => i !== null); // drop blank lines (and tell TypeScript they're gone)
  const servings = Number(servingsText);
  const minutes = Number(minutesText);
  const canSave = title.trim().length > 0 && (!share || ingredients.length > 0) && !saving;

  async function choosePhoto(from: "camera" | "library") {
    setPhotoError(null);
    const result = await pickPhoto(from);
    if (typeof result === "string") return setPhotoError(result);
    if (result === null) return; // cancelled
    tick();
    setPicked(result);
    setPhoto(result.uri); // shows straight away; uploaded when you save
  }

  function removePhoto() {
    tick();
    setPicked(null);
    setPhoto(null);
  }

  async function save() {
    if (!canSave) return;
    // A new photo goes up first, so the recipe is saved with its real path
    let photoPath = photo;
    if (picked && session) {
      setSaving(true);
      try {
        photoPath = await uploadPhoto(picked, session.user.id);
      } catch (e) {
        warning();
        setSaving(false);
        setPhotoError(e instanceof Error ? e.message : "Couldn't upload the photo.");
        return;
      }
    }
    const draft = {
      title: title.trim(),
      description: description.trim() || null,
      servings: Number.isInteger(servings) && servings > 0 ? servings : null,
      minutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
      difficulty,
      tags,
      cover,
      cuisine,
      photo: photoPath,
      sourceUrl: sourceUrl.trim() || null,
      ingredients,
      steps: steps.trim(),
      // Someone else's shared copy stays as it is (only they can change it)
      share: canChangeSharing ? share : false,
    };
    if (existing) {
      updateRecipe(existing.id, draft);
      router.back();
    } else {
      const newId = addRecipe(draft);
      // Swap this form for the new recipe's page
      router.replace({ pathname: "/recipe/[id]", params: { id: newId } });
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Field label="Recipe name">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Weeknight dal"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
        />
      </Field>

      {/* The cover: a photo, or a colour with drawings from the ingredients */}
      <View style={styles.coverPreview}>
        <RecipeCover
          cover={cover}
          ingredients={ingredients}
          photo={photo}
          height={photo ? 200 : 140}
          radius={radius.lg}
        />
      </View>
      <View style={styles.photoButtons}>
        <Pressable onPress={() => choosePhoto("camera")} style={styles.photoButton}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.photoButtonText}>{photo ? "Retake" : "Take photo"}</Text>
        </Pressable>
        <Pressable onPress={() => choosePhoto("library")} style={styles.photoButton}>
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.photoButtonText}>{photo ? "Choose another" : "Choose photo"}</Text>
        </Pressable>
        {photo && (
          <Pressable onPress={removePhoto} style={styles.photoButton} hitSlop={6}>
            <Ionicons name="trash-outline" size={18} color={colors.urgent} />
          </Pressable>
        )}
      </View>
      {photoError && <Text style={styles.photoError}>{photoError}</Text>}
      {photo && share && (
        <Text style={styles.hintSmall}>
          Shared recipes show their photo to everyone on PantryGo.
        </Text>
      )}
      {!photo && (
        <View style={styles.swatches}>
          {COVER_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                tick();
                setCover(key);
              }}
              style={[styles.swatch, cover === key && styles.swatchOn]}
              accessibilityLabel={`${key} cover`}
              accessibilityState={{ selected: cover === key }}
            >
              <RecipeCover cover={key} ingredients={[]} height={40} radius={radius.sm} />
            </Pressable>
          ))}
        </View>
      )}

      <Field label="Short description (optional)">
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What makes it good, in a sentence"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          maxLength={300}
          multiline
        />
      </Field>

      <View style={styles.row}>
        <Field label="Minutes" style={{ width: 90 }}>
          <TextInput
            value={minutesText}
            onChangeText={setMinutesText}
            placeholder="30"
            placeholderTextColor={colors.textSoft}
            keyboardType="number-pad"
            style={styles.input}
          />
        </Field>
        <Field label="Serves" style={{ width: 90 }}>
          <TextInput
            value={servingsText}
            onChangeText={setServingsText}
            placeholder="4"
            placeholderTextColor={colors.textSoft}
            keyboardType="number-pad"
            style={styles.input}
          />
        </Field>
        <Field label="Link (optional)" style={{ flex: 1 }}>
          <TextInput
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="https://…"
            placeholderTextColor={colors.textSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </Field>
      </View>

      <Field label="How hard is it?">
        <View style={styles.chipWrap}>
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d.value}
              label={d.label}
              on={difficulty === d.value}
              // Tap the selected one again to clear it
              onPress={() => setDifficulty(difficulty === d.value ? null : d.value)}
            />
          ))}
        </View>
      </Field>

      <Field label="Cuisine">
        <View style={styles.chipWrap}>
          {CUISINES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              on={cuisine === c.value}
              // Tap the selected one again to clear it
              onPress={() => setCuisine(cuisine === c.value ? null : c.value)}
            />
          ))}
        </View>
      </Field>

      <Field label="Tags">
        <View style={styles.chipWrap}>
          {TAGS.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              on={tags.includes(t.value)}
              onPress={() =>
                setTags((prev) =>
                  prev.includes(t.value) ? prev.filter((x) => x !== t.value) : [...prev, t.value],
                )
              }
            />
          ))}
        </View>
      </Field>

      <Field label="Ingredients, one per line">
        <TextInput
          value={ingredientsText}
          onChangeText={setIngredientsText}
          placeholder={"1 cup red lentils\n1 onion\n400 g chopped tomatoes\n2 tbsp olive oil\nsalt"}
          placeholderTextColor={colors.textSoft}
          multiline
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
        />
        <Text style={styles.hint}>
          Start with the amount and unit ("200 g", "2 tbsp", "3") so "Cooked this" can take the
          right amount out of your pantry.{" "}
          {ingredients.length > 0 ? `${ingredients.length} ingredients.` : ""}
        </Text>
      </Field>

      <Field label="Method, one step per line (optional)">
        <TextInput
          value={steps}
          onChangeText={setSteps}
          placeholder={
            "Fry the onion in the oil\nAdd lentils, tomatoes and 3 cups water\nSimmer 25 min"
          }
          placeholderTextColor={colors.textSoft}
          multiline
          style={[styles.input, styles.multiline]}
          textAlignVertical="top"
        />
      </Field>

      {/* ---- Sharing ---- */}
      <View style={styles.shareCard}>
        <Pressable
          onPress={() => {
            if (!canChangeSharing) return;
            tick();
            setShare((v) => !v);
          }}
          style={styles.shareRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: share, disabled: !canChangeSharing }}
        >
          <Ionicons name="globe-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.shareTitle}>Share with everyone on PantryGo</Text>
            <Text style={styles.hint}>
              {isSavedCopy
                ? "This is a copy of a shared recipe, so it can't be shared again."
                : sharedBySomeoneElse
                  ? `Shared by ${sharedCopy?.authorName}. Only they can change the shared version.`
                  : "Anyone can find it in Discover and save a copy. It shows your first name. You can stop sharing at any time."}
            </Text>
          </View>
          <View
            style={[styles.toggle, share && styles.toggleOn, !canChangeSharing && { opacity: 0.4 }]}
          >
            <View style={[styles.knob, share && styles.knobOn]} />
          </View>
        </Pressable>
        {share && canChangeSharing && ingredients.length === 0 && (
          <Text style={styles.error}>Add the ingredients before sharing.</Text>
        )}
      </View>

      <Pressable
        onPress={save}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && !saving && { opacity: 0.4 },
          pressed && { opacity: 0.8 },
        ]}
      >
        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.onPrimary} />
            <Text style={styles.saveText}>Uploading photo…</Text>
          </View>
        ) : (
          <Text style={styles.saveText}>{existing ? "Save changes" : "Save recipe"}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// A tappable pill that can be on or off (several can be on at once)
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: "row", gap: spacing.md },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
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
  multiline: { minHeight: 150 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft, lineHeight: 17 },
  coverPreview: { borderRadius: radius.lg, overflow: "hidden" },
  swatches: { flexDirection: "row", gap: spacing.sm },
  photoButtons: { flexDirection: "row", gap: spacing.sm },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  photoButtonText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
  photoError: { fontFamily: fonts.body, fontSize: 13, color: colors.urgent },
  hintSmall: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },
  savingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: {
    flex: 1,
    borderRadius: radius.sm + 3,
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchOn: { borderColor: colors.text },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.background },
  shareCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  shareRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  shareTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 3,
  },
  toggleOn: { backgroundColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 20 }] },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.urgent },
  saveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
});

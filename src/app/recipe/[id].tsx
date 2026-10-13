import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RecipeView, recipeButtonStyles as b } from "@/components/RecipeView";
import { useAuth } from "@/state/AuthContext";
import { useCommunity } from "@/state/CommunityContext";
import { useHousehold } from "@/state/HouseholdContext";
import { useRecipes } from "@/state/RecipesContext";
import { usePreferences } from "@/state/PreferencesContext";
import { colors, fonts, spacing } from "@/theme";
import { warning } from "@/utils/haptics";

// One of your household's recipes, e.g. /recipe/abc…
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, deleteRecipe } = useRecipes();
  const community = useCommunity();
  const { members } = useHousehold();
  const { session } = useAuth();
  const { prefs } = usePreferences();

  const [confirm, setConfirm] = useState<"delete" | null>(null);

  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "" }} />
        <Text style={styles.muted}>This recipe has been deleted.</Text>
      </View>
    );
  }

  // Who added it, and its shared copy (if any)
  const author = members.find((m) => m.userId === recipe.createdBy);
  const shared = recipe.publishedId
    ? community.recipes.find((c) => c.id === recipe.publishedId)
    : undefined;
  const savedFrom = recipe.savedFrom
    ? community.recipes.find((c) => c.id === recipe.savedFrom)
    : undefined;
  const byline = savedFrom
    ? `Saved from ${savedFrom.authorName}`
    : author
      ? `Added by ${author.userId === session?.user.id ? "you" : author.name}`
      : null;

  function remove() {
    if (confirm !== "delete") return setConfirm("delete");
    warning();
    router.back();
    deleteRecipe(recipe!.id);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/recipe-edit", params: { id: recipe.id } })}
              hitSlop={10}
              style={styles.headerButton}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={styles.headerButtonText}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <RecipeView
        recipe={recipe}
        byline={byline}
        sourceUrl={recipe.sourceUrl}
        actions={(_scaled, serves) => (
          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/cook/[id]",
                  params: { id: recipe.id, serves: String(serves) },
                })
              }
              style={({ pressed }) => [b.primary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="flame" size={20} color={colors.onPrimary} />
              <Text style={b.primaryText}>Cooked this</Text>
            </Pressable>
            {prefs.trackCalories && (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/cook/[id]", params: { id: recipe.id, mode: "eat" } })
                }
                style={({ pressed }) => [b.soft, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
                <Text style={b.softText}>I ate this (add to calories)</Text>
              </Pressable>
            )}
            <Text style={styles.muted}>
              "Cooked this" lets you choose how much comes out of the pantry.
            </Text>
          </View>
        )}
        footnote={
          <View style={styles.footnote}>
            {recipe.publishedId && (
              <Text style={styles.muted}>
                <Ionicons name="globe-outline" size={12} color={colors.textSoft} /> Shared with
                everyone on PantryGo
                {shared && shared.saveCount > 0
                  ? ` · saved ${shared.saveCount} ${shared.saveCount === 1 ? "time" : "times"}`
                  : ""}
              </Text>
            )}
            <Pressable onPress={remove} style={b.small}>
              <Text style={b.danger}>
                {confirm === "delete" ? "Tap again to delete this recipe" : "Delete recipe"}
              </Text>
            </Pressable>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.primary },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, textAlign: "center" },
  footnote: { gap: spacing.sm, alignItems: "center" },
  actions: { gap: spacing.sm },
});

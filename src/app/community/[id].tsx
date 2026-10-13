import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { FilterChips } from "@/components/FilterChips";
import { RecipeView, recipeButtonStyles as b } from "@/components/RecipeView";
import { useAuth } from "@/state/AuthContext";
import { useCommunity } from "@/state/CommunityContext";
import { useRecipes } from "@/state/RecipesContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { success } from "@/utils/haptics";

const REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "not-food", label: "Not a recipe" },
  { value: "offensive", label: "Offensive" },
  { value: "unsafe", label: "Unsafe food advice" },
];

// A recipe shared with everyone, e.g. /community/abc… Save it to cook from your pantry.
export default function CommunityRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const community = useCommunity();
  const { recipes: mine } = useRecipes();
  const { session } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("spam");
  const [reported, setReported] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  // Reporting or blocking hides the recipe, so we leave the page once it's done
  const [leaving, setLeaving] = useState(false);

  const recipe = community.recipes.find((r) => r.id === id);
  if (!recipe && leaving) return <View style={styles.missing} />;
  if (!recipe) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "" }} />
        {community.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.muted}>This recipe isn't shared any more.</Text>
        )}
      </View>
    );
  }

  const isMine = recipe.authorId !== null && recipe.authorId === session?.user.id;
  const isStarter = recipe.authorId === null;
  // Already in your book? (Saved before, or it's your own shared recipe)
  const myCopy = mine.find((r) => r.savedFrom === recipe.id || r.publishedId === recipe.id);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await community.saveToMine(recipe!.id);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    success();
    // Swap this page for your new copy, where you can cook it and edit it
    router.replace({ pathname: "/recipe/[id]", params: { id: result.id } });
  }

  async function sendReport() {
    setLeaving(true);
    const err = await community.report(recipe!.id, reason);
    if (err) {
      setLeaving(false);
      setError(err);
    } else {
      success();
      setReported(true);
      setReporting(false);
      router.back(); // it's hidden for you now
    }
  }

  async function blockAuthor() {
    if (!recipe?.authorId) return;
    if (!confirmBlock) return setConfirmBlock(true); // first tap: ask
    setLeaving(true);
    const err = await community.block(recipe.authorId, recipe.authorName);
    if (err) {
      setLeaving(false);
      setError(err);
    } else {
      success();
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <RecipeView
        recipe={recipe}
        byline={`by ${isMine ? "you" : recipe.authorName}${
          recipe.saveCount > 0
            ? ` · saved ${recipe.saveCount} ${recipe.saveCount === 1 ? "time" : "times"}`
            : ""
        }`}
        actions={() => (
          <>
            {myCopy ? (
              <Pressable
                onPress={() =>
                  router.replace({ pathname: "/recipe/[id]", params: { id: myCopy.id } })
                }
                style={({ pressed }) => [b.soft, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="book" size={18} color={colors.primary} />
                <Text style={b.softText}>In your recipes · Open</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [b.primary, (pressed || saving) && { opacity: 0.85 }]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Ionicons name="bookmark" size={20} color={colors.onPrimary} />
                )}
                <Text style={b.primaryText}>Save to my recipes</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/cook/[id]",
                  params: { id: recipe.id, mode: "eat", from: "community" },
                })
              }
              style={({ pressed }) => [b.soft, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
              <Text style={b.softText}>I ate this (add to calories)</Text>
            </Pressable>
            <Text style={styles.muted}>
              {myCopy
                ? "Your copy is yours to change. Edits don't affect the shared one."
                : "Saving copies it into your household's recipe book, where you can cook it from your pantry and tweak it."}
            </Text>
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
        footnote={
          !isMine && !isStarter ? (
            <View style={styles.footnote}>
              {reported ? (
                <Text style={styles.muted}>Thanks, we've noted your report.</Text>
              ) : reporting ? (
                <View style={styles.reportBox}>
                  <Text style={styles.reportTitle}>What's wrong with it?</Text>
                  <View style={styles.reportChips}>
                    <FilterChips options={REASONS} selected={reason} onSelect={setReason} />
                  </View>
                  <View style={styles.reportButtons}>
                    <Pressable onPress={() => setReporting(false)} style={b.small}>
                      <Text style={b.smallText}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={sendReport} style={b.small}>
                      <Text style={b.danger}>Send report</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Pressable onPress={() => setReporting(true)} style={b.small}>
                    <Text style={b.smallText}>
                      <Ionicons name="flag-outline" size={13} color={colors.textSoft} /> Report this
                      recipe
                    </Text>
                  </Pressable>
                  <Pressable onPress={blockAuthor} style={b.small}>
                    <Text style={confirmBlock ? b.danger : b.smallText}>
                      <Ionicons
                        name="ban-outline"
                        size={13}
                        color={confirmBlock ? colors.urgent : colors.textSoft}
                      />{" "}
                      {confirmBlock
                        ? `Tap again to block ${recipe.authorName}`
                        : `Block ${recipe.authorName}`}
                    </Text>
                  </Pressable>
                  {confirmBlock && (
                    <Text style={styles.muted}>
                      You won't see any of their shared recipes. They won't be told. You can unblock
                      them in Profile.
                    </Text>
                  )}
                </>
              )}
            </View>
          ) : isMine ? (
            <Text style={styles.muted}>
              You shared this. To change or stop sharing it, edit it in My recipes.
            </Text>
          ) : null
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
  muted: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSoft,
    textAlign: "center",
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.urgent, textAlign: "center" },
  footnote: { alignItems: "center" },
  reportBox: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reportTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
    paddingHorizontal: spacing.lg,
  },
  reportChips: { marginHorizontal: -spacing.lg + spacing.lg },
  reportButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.sm,
  },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Animated from "react-native-reanimated";

import { BigHeader } from "@/components/BigHeader";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonCards } from "@/components/Skeleton";
import { FilterChips } from "@/components/FilterChips";
import { PressableScale } from "@/components/PressableScale";
import { RecipeCard } from "@/components/RecipeCard";
import { useAuth } from "@/state/AuthContext";
import { useCommunity } from "@/state/CommunityContext";
import { usePantry } from "@/state/PantryContext";
import { usePreferences } from "@/state/PreferencesContext";
import { useRecipes } from "@/state/RecipesContext";
import { colors, fonts, radius, spacing } from "@/theme";
import { tick } from "@/utils/haptics";
import { rowEntering, rowExiting, rowLayout } from "@/utils/motion";
import { suitsDiet, TAGS } from "@/utils/recipeMeta";
import { recipeReadiness, type CommunityRecipe, type RecipeContent } from "@/utils/recipes";

type Section = "mine" | "discover";

export default function RecipesScreen() {
  const [section, setSection] = useState<Section>("mine");
  const { recipes, refresh } = useRecipes();
  const community = useCommunity();
  const { items } = usePantry();
  const canMake = recipes.filter((r) => recipeReadiness(r, items).canMake).length;
  const [refreshing, setRefreshing] = useState(false);

  // Pull down: reload your recipes and everyone's
  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), community.refresh()]);
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]} // keep the My recipes / Discover switch at the top
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <BigHeader
          eyebrow={canMake > 0 ? `${canMake} you can make now` : "Recipe book"}
          title="Recipes"
        />
        <View style={styles.switchWrap}>
          <Segmented value={section} onChange={setSection} />
        </View>
        {section === "mine" ? (
          <MyRecipes onDiscover={() => setSection("discover")} />
        ) : (
          <Discover />
        )}
      </ScrollView>

      <PressableScale scaleTo={0.92} onPress={() => router.push("/recipe-edit")} style={styles.fab}>
        <Ionicons name="add" size={22} color={colors.onPrimary} />
        <Text style={styles.fabText}>New recipe</Text>
      </PressableScale>
    </View>
  );
}

// ---- The two-way switch at the top ----
function Segmented({ value, onChange }: { value: Section; onChange: (s: Section) => void }) {
  const options: { value: Section; label: string; icon: "book-outline" | "compass-outline" }[] = [
    { value: "mine", label: "My recipes", icon: "book-outline" },
    { value: "discover", label: "Discover", icon: "compass-outline" },
  ];
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!on) tick();
              onChange(o.value);
            }}
            style={[styles.segmentItem, on && styles.segmentOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={o.icon} size={17} color={on ? colors.background : colors.textSoft} />
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// My recipes: your household's book, most makeable first
// ---------------------------------------------------------------------------
function MyRecipes({ onDiscover }: { onDiscover: () => void }) {
  const { recipes, loading } = useRecipes();
  const { items } = usePantry();

  const ranked = recipes
    .map((recipe) => ({ recipe, ready: recipeReadiness(recipe, items) }))
    .sort((a, b) => {
      const pa = a.ready.total ? a.ready.have / a.ready.total : 0;
      const pb = b.ready.total ? b.ready.have / b.ready.total : 0;
      return pb - pa || a.recipe.title.localeCompare(b.recipe.title);
    });
  const ready = ranked.filter((r) => r.ready.canMake);
  const rest = ranked.filter((r) => !r.ready.canMake);

  if (loading) return <SkeletonCards />;

  if (recipes.length === 0) {
    return (
      <EmptyState
        inset
        art={["spaghetti", "curry-rice", "pie"]}
        title="Your recipe book is empty"
        text="Save a few starters from Discover, or add the meals you already make. PantryGo shows what you can cook from your pantry and adds anything missing to the shopping list."
        action={{ label: "Browse recipes", onPress: onDiscover }}
        secondary={{ label: "Add my own recipe", onPress: () => router.push("/recipe-edit") }}
      />
    );
  }

  const footerFor = (r: (typeof ranked)[number]) =>
    r.ready.total === 0
      ? null
      : r.ready.canMake
        ? "You have everything"
        : `You have ${r.ready.have} of ${r.ready.total}`;

  return (
    <View style={styles.sections}>
      {ready.length > 0 && (
        <Grid
          title="Ready to cook"
          items={ready.map((r) => ({
            key: r.recipe.id,
            recipe: r.recipe,
            footer: footerFor(r),
            badge: { label: "Can make", tone: "good" as const },
            onPress: () => router.push({ pathname: "/recipe/[id]", params: { id: r.recipe.id } }),
          }))}
        />
      )}
      {rest.length > 0 && (
        <Grid
          title={ready.length > 0 ? "Everything else" : "All recipes"}
          items={rest.map((r) => ({
            key: r.recipe.id,
            recipe: r.recipe,
            footer: footerFor(r),
            badge: r.recipe.publishedId ? { label: "Shared", tone: "plain" as const } : null,
            onPress: () => router.push({ pathname: "/recipe/[id]", params: { id: r.recipe.id } }),
          }))}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Discover: everyone's shared recipes plus the PantryGo Kitchen starters
// ---------------------------------------------------------------------------
function Discover() {
  const community = useCommunity();
  const { recipes: mine } = useRecipes();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = community.recipes.filter(
    (r) =>
      (tag === "all" || r.tags.includes(tag)) &&
      (q === "" ||
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))),
  );
  const browsing = q === "" && tag === "all";
  const popular = community.recipes.filter((r) => r.saveCount > 0).slice(0, 6);

  // For you: cuisines you picked in Food preferences, that suit how you eat
  const { prefs } = usePreferences();
  const forYou =
    prefs.cuisines.length === 0 && prefs.diet === "any"
      ? []
      : community.recipes
          .filter(
            (r) =>
              suitsDiet(r.tags, prefs.diet) &&
              (prefs.cuisines.length === 0 ||
                (r.cuisine !== null && prefs.cuisines.includes(r.cuisine))),
          )
          .slice(0, 8);

  const savedIds = new Set(mine.map((r) => r.savedFrom).filter(Boolean));
  const footerFor = (r: CommunityRecipe) => {
    const who = r.authorId === session?.user.id ? "you" : r.authorName;
    return `by ${who}${r.saveCount > 0 ? ` · ${r.saveCount} ${r.saveCount === 1 ? "save" : "saves"}` : ""}`;
  };
  const open = (r: CommunityRecipe) =>
    router.push({ pathname: "/community/[id]", params: { id: r.id } });

  async function onRefresh() {
    setRefreshing(true);
    await community.refresh();
    setRefreshing(false);
  }

  return (
    <View style={styles.sections}>
      <View style={styles.searchPill}>
        <Ionicons name="search" size={18} color={colors.textSoft} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recipes or ingredients"
          placeholderTextColor={colors.textSoft}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search !== "" && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSoft} />
          </Pressable>
        )}
      </View>

      <View style={styles.chipsBleed}>
        <FilterChips
          options={[{ value: "all", label: "All" }, ...TAGS]}
          selected={tag}
          onSelect={setTag}
        />
      </View>

      {community.loading ? (
        <View style={styles.bleedFull}>
          <SkeletonCards />
        </View>
      ) : community.error ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Couldn't load recipes</Text>
          <Text style={styles.emptyText}>
            Check your connection. If this keeps happening, make sure 09_recipe_book.sql has been
            run in Supabase.
          </Text>
          <Pressable onPress={onRefresh} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>{refreshing ? "Trying…" : "Try again"}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* For you: matches your food preferences */}
          {browsing && forYou.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>For you</Text>
                <Pressable onPress={() => router.push("/food-preferences")} hitSlop={8}>
                  <Text style={styles.sectionLink}>Edit tastes</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.wideRow}
                style={styles.rowBleed}
              >
                {forYou.map((r) => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    variant="wide"
                    footer={footerFor(r)}
                    badge={savedIds.has(r.id) ? { label: "Saved", tone: "good" } : null}
                    onPress={() => open(r)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Most saved: a horizontal row of big cards */}
          {browsing && popular.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Most saved</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.wideRow}
                style={styles.rowBleed}
              >
                {popular.map((r) => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    variant="wide"
                    footer={footerFor(r)}
                    badge={savedIds.has(r.id) ? { label: "Saved", tone: "good" } : null}
                    onPress={() => open(r)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {filtered.length === 0 ? (
            <Text style={styles.muted}>Nothing matches. Try another word or tag.</Text>
          ) : (
            <Grid
              title={
                browsing
                  ? "All recipes"
                  : `${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"}`
              }
              items={filtered.map((r) => ({
                key: r.id,
                recipe: r,
                footer: footerFor(r),
                badge: savedIds.has(r.id) ? { label: "Saved", tone: "good" as const } : null,
                onPress: () => open(r),
              }))}
            />
          )}
          <Text style={styles.muted}>
            Share your own from its edit screen: "Share with everyone on PantryGo".
          </Text>
        </>
      )}
    </View>
  );
}

// ---- A titled 2-column grid of recipe cards ----
function Grid({
  title,
  items,
}: {
  title: string;
  items: {
    key: string;
    recipe: RecipeContent;
    footer: string | null;
    badge: { label: string; tone: "good" | "plain" } | null;
    onPress: () => void;
  }[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>
        {items.map((it, i) => (
          <Animated.View
            key={it.key}
            entering={rowEntering(i)}
            exiting={rowExiting}
            layout={rowLayout}
            style={styles.gridCell}
          >
            <RecipeCard
              recipe={it.recipe}
              footer={it.footer}
              badge={it.badge}
              onPress={it.onPress}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 110 },
  switchWrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentOn: { backgroundColor: colors.text },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  segmentTextOn: { color: colors.background },

  sections: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
  section: { gap: spacing.md },
  bleedFull: { marginHorizontal: -spacing.lg },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionLink: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  gridCell: { width: "48%" }, // two per row
  wideRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  rowBleed: { marginHorizontal: -spacing.lg }, // let the row scroll edge to edge
  chipsBleed: { marginHorizontal: -spacing.lg, marginTop: -spacing.md },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 46,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, padding: 0 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft, textAlign: "center" },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: "center",
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text, textAlign: "center" },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },

  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
});

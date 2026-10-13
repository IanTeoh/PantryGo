import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActivityList } from "@/components/ActivityList";
import { BigHeader } from "@/components/BigHeader";
import { CaloriesCard } from "@/components/CaloriesCard";
import { Gradient } from "@/components/Gradient";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";
import { PressableScale } from "@/components/PressableScale";
import { FoodIcon } from "@/components/FoodIcon";
import { RecipeCover } from "@/components/RecipeCover";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { usePantry } from "@/state/PantryContext";
import { usePreferences } from "@/state/PreferencesContext";
import { useCommunity } from "@/state/CommunityContext";
import { useRecipes } from "@/state/RecipesContext";
import { useReminders } from "@/state/RemindersContext";
import { useShopping } from "@/state/ShoppingContext";
import { colors, fonts, radius, spacing, tints, type Tint } from "@/theme";
import type { Item } from "@/types";
import type { Recipe } from "@/utils/recipes";
import { daysUntil } from "@/utils/dates";
import { suitsDiet } from "@/utils/recipeMeta";
import { compareByExpiry, getFreshness } from "@/utils/freshness";
import { checkIngredient, recipeReadiness } from "@/utils/recipes";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// "Chicken today · milk tomorrow · spinach"
function soonSummary(items: Item[]): string {
  return items
    .slice(0, 3)
    .map((it, i) => {
      const days = daysUntil(it.expiry!);
      const name = i === 0 ? it.name : it.name.toLowerCase();
      if (days <= 0) return `${name} today`;
      if (days === 1) return `${name} tomorrow`;
      return name;
    })
    .join(" · ");
}

export default function HomeScreen() {
  const { session } = useAuth();
  const { household, members } = useHousehold();
  const { items, events, refresh, live } = usePantry();
  const { recipes } = useRecipes();
  const community = useCommunity();
  const reminders = useReminders();
  const { list } = useShopping();
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false); // the household switcher is open

  const firstName = ((session?.user.user_metadata?.display_name as string) || "").split(" ")[0];
  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { prefs } = usePreferences();

  // ---- Derived ----
  const useSoon = items
    .filter((it) => it.quantity > 0 && ["urgent", "soon"].includes(getFreshness(it)))
    .sort(compareByExpiry);
  const toBuy = list.filter((r) => !r.done).length;

  // "Cook tonight": recipes ranked by how much you have, then by whether they use
  // something that needs using soon. Your own first; popular shared ones fill the rest.
  function rank(recipe: { ingredients: Recipe["ingredients"] }) {
    const ready = recipeReadiness(recipe, items);
    const usesSoon = recipe.ingredients
      .map((ing) => checkIngredient(ing, items))
      .flatMap((c) =>
        c.status === "have" && useSoon.some((u) => u.id === c.item.id) ? [c.item] : [],
      );
    const score = (ready.total ? ready.have / ready.total : 0) + usesSoon.length * 0.25;
    return { ready, usesSoon, score };
  }
  const savedIds = new Set(recipes.map((r) => r.savedFrom ?? r.publishedId).filter(Boolean));
  const ownPicks = recipes
    .map((recipe) => ({ recipe, source: "mine" as const, popular: false, ...rank(recipe) }))
    .filter((r) => r.ready.total > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  // Shared ones also lean towards your food preferences: never ones that don't suit
  // how you eat, and a nudge up for cuisines you picked
  const likes = (c: { cuisine: string | null }) =>
    c.cuisine !== null && prefs.cuisines.includes(c.cuisine) ? 0.3 : 0;
  const sharedPicks = community.recipes
    .filter((c) => !savedIds.has(c.id) && suitsDiet(c.tags, prefs.diet))
    .map((recipe) => {
      const r = rank(recipe);
      return {
        recipe,
        source: "community" as const,
        popular: true,
        ...r,
        score: r.score + likes(recipe),
      };
    })
    .filter((r) => r.ready.total > 0)
    // what you could nearly make, then the most saved
    .sort((a, b) => b.score - a.score || b.recipe.saveCount - a.recipe.saveCount)
    .slice(0, Math.max(0, 5 - ownPicks.length));
  const cookTonight = [...ownPicks, ...sharedPicks];

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <BigHeader eyebrow={today} title={firstName ? `${greeting()},\n${firstName}` : greeting()} />

      <View style={styles.body}>
        {/* Household + live status. Tap to switch household. */}
        <Pressable
          onPress={() => setSwitching(true)}
          hitSlop={8}
          style={styles.householdRow}
          accessibilityRole="button"
          accessibilityLabel={`${household?.name}. Switch household`}
        >
          <Text style={styles.householdName}>{household?.name}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSoft} />
          <View style={styles.sep} />
          <View
            style={[styles.liveDot, { backgroundColor: live ? colors.fresh : colors.border }]}
          />
          {/* The people count opens the household page (everyone, and the owner) */}
          <Pressable
            onPress={() =>
              household &&
              router.push({ pathname: "/household/[id]", params: { id: household.id } })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="See household members"
          >
            <Text style={styles.householdMeta}>
              {live ? "Live" : "Offline"} · {members.length}{" "}
              {members.length === 1 ? "person" : "people"}
            </Text>
          </Pressable>
        </Pressable>
        <HouseholdSwitcher visible={switching} onClose={() => setSwitching(false)} />

        {/* ---- Hero: cook tonight ---- */}
        <View style={styles.hero}>
          <Gradient />
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>COOK TONIGHT</Text>
              <Text style={styles.heroTitle}>
                {cookTonight.length > 0 ? "From what you've got" : "Your recipe book"}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/recipes")} hitSlop={8}>
              <Text style={styles.heroLink}>See all</Text>
            </Pressable>
          </View>

          {cookTonight.length === 0 ? (
            <View style={styles.heroEmpty}>
              <Text style={styles.heroEmptyText}>
                Add the meals you make. PantryGo will suggest what to cook from what's in your
                pantry.
              </Text>
              <Pressable
                onPress={() => router.push("/recipe-edit")}
                style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.heroButtonText}>Add a recipe</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeRow}
            >
              {cookTonight.map(({ recipe, source, popular, ready, usesSoon }) => {
                const tag = ready.canMake
                  ? "You can make this"
                  : usesSoon.length > 0
                    ? `Uses your ${usesSoon[0].name.toLowerCase()}`
                    : popular
                      ? "Popular on PantryGo"
                      : `You have ${ready.have} of ${ready.total}`;
                return (
                  <PressableScale
                    key={`${source}-${recipe.id}`}
                    onPress={() =>
                      source === "mine"
                        ? router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })
                        : router.push({ pathname: "/community/[id]", params: { id: recipe.id } })
                    }
                    style={styles.recipeCard}
                  >
                    <View>
                      <RecipeCover
                        cover={recipe.cover}
                        ingredients={recipe.ingredients}
                        photo={recipe.photo}
                        height={92}
                      />
                      <Text style={[styles.recipeTag, ready.canMake && styles.recipeTagGood]}>
                        {tag}
                      </Text>
                    </View>
                    <View style={styles.recipeText}>
                      <Text style={styles.recipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <Text style={styles.recipeMeta}>
                        {ready.have} of {ready.total} ingredients
                        {recipe.minutes ? ` · ${recipe.minutes} min` : ""}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ---- Quick actions ---- */}
        <View style={styles.actions}>
          <QuickAction
            icon="barcode-outline"
            label="Scan"
            tint={tints.sky}
            onPress={() => router.push({ pathname: "/add-item", params: { scan: "1" } })}
          />
          <QuickAction
            icon="add"
            label="Add item"
            tint={tints.mint}
            onPress={() => router.push("/add-item")}
          />
          <QuickAction
            icon="cart-outline"
            label={toBuy > 0 ? `List · ${toBuy}` : "List"}
            tint={tints.honey}
            onPress={() => router.push("/shopping")}
          />
        </View>

        {/* ---- A one-time offer to turn on expiry reminders ---- */}
        {reminders.permission === "undetermined" && !reminders.prefs.asked && (
          <View style={styles.reminderCard}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.reminderTitle}>Get a heads-up before food goes off</Text>
              <Text style={styles.reminderText}>
                One short reminder on days something needs using. Change it any time in your
                profile.
              </Text>
              <View style={styles.reminderButtons}>
                <PressableScale
                  scaleTo={0.95}
                  onPress={() => reminders.turnOn()}
                  style={styles.reminderOn}
                >
                  <Text style={styles.reminderOnText}>Turn on</Text>
                </PressableScale>
                <Pressable onPress={() => reminders.updatePrefs({ asked: true })} hitSlop={8}>
                  <Text style={styles.reminderLater}>Not now</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ---- Today's calories (private to you) ---- */}
        <CaloriesCard variant="today" />

        {/* ---- Use soon (slim) ---- */}
        {useSoon.length > 0 && (
          <PressableScale
            scaleTo={0.97}
            onPress={() => router.push("/pantry")}
            style={styles.soonRow}
          >
            <View style={styles.soonIcons}>
              {useSoon.slice(0, 3).map((it, i) => (
                <View key={it.id} style={[styles.soonIconWrap, i > 0 && { marginLeft: -10 }]}>
                  <FoodIcon
                    name={it.name}
                    container={it.container}
                    location={it.location}
                    size={34}
                  />
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.soonTitle}>{useSoon.length} to use soon</Text>
              <Text style={styles.soonText} numberOfLines={1}>
                {soonSummary(useSoon)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
          </PressableScale>
        )}

        {/* ---- Recent ---- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <ActivityList
            events={events.slice(0, 4)}
            emptyText="Nothing yet. Add or use something in your pantry and it'll show up here."
          />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint: Tint;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.93}
      onPress={onPress}
      style={[styles.action, { backgroundColor: tint.bg }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={tint.icon} />
      <Text style={styles.actionText}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl * 2 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  householdRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -4 },
  householdName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  sep: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  householdMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSoft },

  hero: {
    backgroundColor: colors.hero,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg + 4,
    gap: spacing.md,
    overflow: "hidden",
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg + 4,
  },
  heroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onHeroSoft,
  },
  heroTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.onHero, marginTop: 2 },
  heroLink: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.onHero },
  heroEmpty: { paddingHorizontal: spacing.lg + 4, gap: spacing.md },
  heroEmptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onHeroSoft },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.onHero,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  heroButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.hero },
  recipeRow: { gap: 10, paddingHorizontal: spacing.lg + 4 },
  recipeCard: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  recipeArt: {
    height: 92,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeTag: {
    position: "absolute",
    top: 10,
    left: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  recipeTagGood: { backgroundColor: colors.primary, color: colors.onPrimary },
  recipeText: { padding: spacing.md, gap: 4 },
  recipeTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  recipeMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft },

  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    height: 76,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },

  soonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
  },
  soonIcons: { flexDirection: "row" },
  soonIconWrap: { borderRadius: 13, borderWidth: 2, borderColor: colors.surface },
  soonTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  soonText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSoft, marginTop: 2 },

  section: { gap: spacing.sm },
  reminderCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  reminderTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  reminderText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  reminderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  reminderOn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  reminderOnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
  reminderLater: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSoft },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
});

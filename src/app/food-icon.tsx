import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useDeferredValue, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { FoodArt } from "@/components/FoodIcon";
import { TextInput } from "@/components/TextInput";
import type { FoodArtName } from "@/data/foodArt";
import { useFoodIcons } from "@/state/FoodIconsContext";
import { colors, fonts, radius, spacing } from "@/theme";
import type { ContainerType, Location } from "@/types";
import { ALL_ART, pickArt } from "@/utils/foodArt";
import { success, tick } from "@/utils/haptics";

// ---------------------------------------------------------------------------
// Choosing a different picture for a food, e.g. /food-icon?name=Tofu&container=box&location=fridge
// The pick is remembered by name for the whole household (see FoodIconsContext).
// ---------------------------------------------------------------------------

const COLUMNS = 5;

export default function FoodIconScreen() {
  const params = useLocalSearchParams<{ name: string; container?: string; location?: string }>();
  const name = params.name ?? "";
  const container = (params.container ?? "countable") as ContainerType;
  const location = (params.location ?? "pantry") as Location;

  const { chosenArt, chooseArt } = useFoodIcons();
  const picked = chosenArt(name);
  const guess = pickArt(name, container, location);
  const current = picked ?? guess;

  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const shown = q ? ALL_ART.filter((a) => a.words.includes(q)) : ALL_ART;

  const { width } = useWindowDimensions();
  const tile = Math.floor((width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);

  async function choose(art: FoodArtName | null) {
    tick();
    const message = await chooseArt(name, art);
    if (message) return setError(message);
    success();
    router.back();
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={shown}
      keyExtractor={(a) => a.art}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: spacing.sm }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={30}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.preview}>
            <View style={styles.previewTile}>
              <FoodArt art={current} size={44} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.sub}>
                Changes every “{name.trim()}” in your household, on everyone's phone.
              </Text>
            </View>
          </View>

          {picked && (
            <Pressable onPress={() => choose(null)} style={styles.reset} hitSlop={6}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.resetText}>Go back to PantryGo's pick</Text>
            </Pressable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textSoft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search, e.g. bean, bottle, cheese"
              placeholderTextColor={colors.textSoft}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No pictures match “{query.trim()}”. Try a simpler word.</Text>
      }
      renderItem={({ item }) => {
        const on = item.art === current;
        return (
          <Pressable
            onPress={() => choose(item.art)}
            style={({ pressed }) => [
              styles.tile,
              { width: tile, height: tile },
              on && styles.tileOn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.art.replace(/-/g, " ")}
            accessibilityState={{ selected: on }}
          >
            <FoodArt art={item.art} size={tile * 0.6} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  previewTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSoft },
  reset: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  resetText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.primary },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.urgent },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});

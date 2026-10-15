import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { FoodArt } from "@/components/FoodIcon";
import { PressableScale } from "@/components/PressableScale";
import type { FoodArtName } from "@/data/foodArt";
import { pickPhoto, uploadPhoto, type PhotoBucket } from "@/lib/photos";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/AuthContext";
import { useHousehold } from "@/state/HouseholdContext";
import { colors, fonts, radius, spacing, tints } from "@/theme";
import {
  AVATAR_ART,
  AVATAR_TINTS,
  isUploadedAvatar,
  makeDrawnAvatar,
  readDrawnAvatar,
  type AvatarTint,
} from "@/utils/avatars";
import { success, tick } from "@/utils/haptics";
import { myAvatar, myName } from "@/utils/me";

// ---------------------------------------------------------------------------
// Choosing a picture: a photo, or one of the food drawings on a colour you like.
//   /avatar                  your profile picture (opened from Profile)
//   /avatar?household=<id>   a household's picture (opened from the household page);
//                            anyone in the household can change it
// ---------------------------------------------------------------------------

const COLUMNS = 5;

export default function AvatarScreen() {
  const { session, setMyAvatar } = useAuth();
  const { households, refresh } = useHousehold();
  const params = useLocalSearchParams<{ household?: string }>();
  const user = session?.user;
  const household = params.household
    ? households.find((h) => h.id === params.household)
    : undefined;
  const forHousehold = !!params.household;

  const name = forHousehold ? (household?.name ?? "") : myName(user) || "You";
  const current = forHousehold ? (household?.photo ?? null) : myAvatar(user);
  const bucket: PhotoBucket = forHousehold ? "household-photos" : "avatars";
  const folder = forHousehold ? params.household : user?.id; // where an uploaded photo goes

  async function setHouseholdPhoto(value: string | null) {
    const { data, error } = await supabase
      .from("households")
      .update({ photo: value })
      .eq("id", params.household!)
      .select("id");
    if (error)
      return error.message.includes("photo")
        ? "Household pictures need a quick database update (supabase/28_household_photos.sql)."
        : error.message;
    if (!data?.length) return "You're not in this household any more.";
    return null;
  }
  const currentDrawing = readDrawnAvatar(current);

  // The drawing you're trying out (shown in the big circle until you save)
  const [art, setArt] = useState<FoodArtName | null>(currentDrawing?.art ?? null);
  const [tint, setTint] = useState<AvatarTint>(currentDrawing?.tint ?? "mint");
  const [busy, setBusy] = useState<"photo" | "save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = art ? makeDrawnAvatar(art, tint) : current;
  const changed = art !== null && preview !== current;

  const { width } = useWindowDimensions();
  const tile = Math.floor((width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);

  // Saves the new picture, tidies up an old uploaded photo, and closes
  async function save(value: string | null, kind: "photo" | "save" | "remove") {
    setBusy(kind);
    const message = forHousehold ? await setHouseholdPhoto(value) : await setMyAvatar(value);
    setBusy(null);
    if (message) return setError(message);
    success();
    if (isUploadedAvatar(current) && current !== value) {
      supabase.storage.from(bucket).remove([current]); // the old photo's file
    }
    refresh(); // so housemates' lists show it too
    router.back();
  }

  async function choosePhoto(from: "camera" | "library") {
    if (!folder) return;
    setError(null);
    const picked = await pickPhoto(from, "square");
    if (picked === null) return; // cancelled
    if (typeof picked === "string") return setError(picked);
    setBusy("photo");
    try {
      const path = await uploadPhoto(picked, folder, bucket);
      await save(path, "photo");
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {forHousehold && <Stack.Screen options={{ title: "Household picture" }} />}
      {/* ---- How it looks ---- */}
      <View style={styles.previewBlock}>
        <Avatar name={name} photo={preview} size={112} bucket={bucket} />
        <Text style={styles.hint}>
          {forHousehold
            ? `Everyone in ${name || "this household"} sees this.`
            : "Housemates see this next to your name."}
        </Text>
      </View>

      {/* ---- A photo ---- */}
      <View style={styles.photoRow}>
        <PhotoButton
          icon="camera-outline"
          label="Take a photo"
          onPress={() => choosePhoto("camera")}
          disabled={busy !== null}
        />
        <PhotoButton
          icon="images-outline"
          label="Choose a photo"
          onPress={() => choosePhoto("library")}
          disabled={busy !== null}
        />
      </View>
      {busy === "photo" && (
        <View style={styles.uploading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Uploading…</Text>
        </View>
      )}

      {/* ---- Or a drawing ---- */}
      <View style={{ gap: spacing.md }}>
        <Text style={styles.label}>OR PICK A DRAWING</Text>
        <View style={styles.tints}>
          {AVATAR_TINTS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                tick();
                setTint(t);
                if (!art) setArt(AVATAR_ART[0]); // so the colour shows straight away
              }}
              style={[
                styles.tint,
                { backgroundColor: tints[t].bg },
                tint === t && { borderColor: tints[t].icon },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t} background`}
              accessibilityState={{ selected: tint === t }}
            >
              {tint === t && <Ionicons name="checkmark" size={18} color={tints[t].icon} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {AVATAR_ART.map((a) => {
            const on = a === art;
            return (
              <Pressable
                key={a}
                onPress={() => {
                  tick();
                  setArt(a);
                }}
                style={[
                  styles.cell,
                  { width: tile, height: tile, borderRadius: tile / 2 },
                  { backgroundColor: tints[tint].bg },
                  on && { borderColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel={a.replace(/-/g, " ")}
                accessibilityState={{ selected: on }}
              >
                <FoodArt art={a} size={Math.round(tile * 0.58)} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* ---- Save / remove ---- */}
      <View style={{ gap: spacing.md }}>
        <PressableScale
          scaleTo={0.97}
          onPress={() => preview && save(preview, "save")}
          disabled={!changed || busy !== null}
          style={[styles.button, (!changed || busy !== null) && { opacity: 0.45 }]}
        >
          {busy === "save" ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Use this drawing</Text>
          )}
        </PressableScale>
        {current && (
          <Pressable
            onPress={() => save(null, "remove")}
            disabled={busy !== null}
            hitSlop={8}
            style={{ alignSelf: "center" }}
          >
            <Text style={styles.remove}>
              {busy === "remove"
                ? "Removing…"
                : `Remove picture (show ${forHousehold ? "the" : "my"} initial)`}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "camera-outline" | "images-outline";
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.photoButton, (pressed || disabled) && { opacity: 0.6 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.photoButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },
  previewBlock: { alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.textSoft, textAlign: "center" },
  photoRow: { flexDirection: "row", gap: spacing.md },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoButtonText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.primary },
  uploading: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: -spacing.md,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, color: colors.textSoft },
  tints: { flexDirection: "row", gap: spacing.md },
  tint: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.urgent, textAlign: "center" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary },
  remove: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.urgent },
});

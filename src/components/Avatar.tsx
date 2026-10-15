import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FoodArt } from "@/components/FoodIcon";
import { photoUrl, type PhotoBucket } from "@/lib/photos";
import { colors, fonts, tints } from "@/theme";
import { readDrawnAvatar } from "@/utils/avatars";

// A person's picture in a circle, or their initial if they haven't added one
// (or it can't load).
//   photo: a path in the avatars bucket, a full link (e.g. their Google photo),
//          or a ready-made drawing like "art:avocado:mint" (see utils/avatars.ts)
export function Avatar({
  name,
  photo,
  size = 40,
  background = colors.primary,
  color = colors.onPrimary,
  font = fonts.heading,
  bucket = "avatars",
  shape = "circle",
}: {
  name: string;
  photo: string | null | undefined;
  size?: number;
  background?: string;
  color?: string;
  font?: string;
  bucket?: PhotoBucket; // "household-photos" for a household's picture
  shape?: "circle" | "rounded"; // households are rounded squares, people are circles
}) {
  const drawn = readDrawnAvatar(photo);
  const url = drawn ? null : photoUrl(photo ?? null, bucket);
  const [failed, setFailed] = useState<string | null>(null);
  const circle = {
    width: size,
    height: size,
    borderRadius: shape === "circle" ? size / 2 : Math.round(size * 0.33),
  };

  if (drawn) {
    return (
      <View
        style={[styles.wrap, circle, { backgroundColor: tints[drawn.tint].bg }]}
        accessible
        accessibilityLabel={`${name || "Your"} profile picture`}
      >
        <FoodArt art={drawn.art} size={Math.round(size * 0.62)} />
      </View>
    );
  }

  if (url && url !== failed) {
    return (
      <View style={[styles.wrap, circle, { backgroundColor: background }]}>
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailed(url)}
          accessibilityLabel={`${name || "Your"} profile picture`}
        />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, circle, { backgroundColor: background }]}>
      <Text style={[styles.initial, { color, fontFamily: font, fontSize: size * 0.42 }]}>
        {(name.trim().charAt(0) || "?").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: {},
});

import type { ComponentProps } from "react";
import { TextInput as RNTextInput, StyleSheet } from "react-native";

import { fonts } from "@/theme";

// Use this instead of React Native's TextInput everywhere in the app.
//
// Why: on iPhone, React Native reuses the native text boxes behind the scenes to
// save memory. When a box is reused, a style the old one had but the new one
// doesn't mention (like the house code's wide letter spacing) can stay stuck on
// it, so "Add to the list…" ends up spaced out. Setting these styles on every box
// means there's never anything left over to stick. A screen's own style still wins.
export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.body,
    fontWeight: "normal",
    fontStyle: "normal",
    letterSpacing: 0,
    textAlign: "left",
  },
});

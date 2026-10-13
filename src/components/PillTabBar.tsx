import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Tabs } from "expo-router";

import { colors, fonts } from "@/theme";

// What Tabs hands its `tabBar`: which tab is open, each tab's options, and navigation
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// ---------------------------------------------------------------------------
// The bar along the bottom. Drawn by us (instead of the built-in one) so the
// selected tab gets a rounded pill around BOTH its icon and its label.
// Icons, labels and badges still come from each Tabs.Screen's options.
// ---------------------------------------------------------------------------
export function PillTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.textSoft;
        const label = typeof options.title === "string" ? options.title : route.name;
        const badge = options.tabBarBadge;

        function onPress() {
          // Same events as the built-in bar, so screenListeners (the haptic tick) still work
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          >
            <View style={[styles.pill, focused && styles.pillOn]}>
              <View>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
                {badge !== undefined && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: "center" },
  pill: {
    alignItems: "center",
    gap: 2,
    minWidth: 56,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 18, // big enough to look like a pill around icon + label
  },
  pillOn: { backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.bodyBold, fontSize: 11 },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.soon,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.onPrimary },
});

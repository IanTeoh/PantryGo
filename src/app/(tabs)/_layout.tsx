import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, router } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, type ColorValue } from "react-native";

import { PillTabBar } from "@/components/PillTabBar";
import { useShopping } from "@/state/ShoppingContext";
import { colors, fonts } from "@/theme";
import { tick } from "@/utils/haptics";

// The name of any Ionicons icon, e.g. "leaf" or "leaf-outline".
type IconName = ComponentProps<typeof Ionicons>["name"];

// Makes the function Tabs uses to draw one tab's icon:
// the filled version when the tab is selected, the outline version when it isn't.
// (The rounded pill behind the selected tab is drawn by PillTabBar.)
function tabIcon(filled: IconName, outline: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={22} color={color} />
  );
}

export default function TabLayout() {
  const { list } = useShopping();
  const toBuyCount = list.filter((r) => !r.done).length;

  return (
    <Tabs
      // Our own bottom bar, with a rounded pill around the selected tab
      tabBar={(props) => <PillTabBar {...props} />}
      // A light tick each time you switch tab
      screenListeners={{ tabPress: () => tick() }}
      // screenOptions apply to every tab
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.heading, color: colors.text, fontSize: 22 },
        headerShadowVisible: false,
        // The person icon in the top-right of tabs that use the standard header
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/account")}
            hitSlop={10}
            style={{ marginRight: 16 }}
            accessibilityLabel="Account"
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          </Pressable>
        ),
      }}
    >
      {/* Every tab draws its own big title (BigHeader), so the standard header is hidden */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          headerShown: false,
          tabBarIcon: tabIcon("basket", "basket-outline"),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: "Shopping",
          headerShown: false, // big title, like the other tabs
          tabBarIcon: tabIcon("cart", "cart-outline"),
          // The little number on the tab: how many things are left to buy
          tabBarBadge: toBuyCount > 0 ? toBuyCount : undefined,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: "Recipes",
          headerShown: false, // draws its own big title, like Home and Pantry
          tabBarIcon: tabIcon("book", "book-outline"),
        }}
      />
      {/* Shown as "Insights". The file is still impact.tsx, so links to /impact keep working. */}
      <Tabs.Screen
        name="impact"
        options={{
          title: "Insights",
          headerShown: false,
          tabBarIcon: tabIcon("stats-chart", "stats-chart-outline"),
        }}
      />
    </Tabs>
  );
}

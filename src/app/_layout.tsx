import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LaunchSplash } from "@/components/LaunchSplash";
import { SetNewPassword } from "@/components/SetNewPassword";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { BudgetProvider } from "@/state/BudgetContext";
import { CommunityProvider } from "@/state/CommunityContext";
import { FoodIconsProvider } from "@/state/FoodIconsContext";
import { HouseholdProvider, useHousehold } from "@/state/HouseholdContext";
import { NutritionProvider } from "@/state/NutritionContext";
import { PantryProvider } from "@/state/PantryContext";
import { PreferencesProvider, usePreferences } from "@/state/PreferencesContext";
import { RecipesProvider } from "@/state/RecipesContext";
import { RemindersProvider } from "@/state/RemindersContext";
import { ShoppingProvider } from "@/state/ShoppingContext";
import { colors, fonts, isDark } from "@/theme";

// Keep the splash screen up until we say otherwise. This runs once, when the file loads.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Start loading the fonts. `loaded` becomes true when they're ready.
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  // Still loading: draw nothing. The splash screen is still covering everything.
  if (!loaded && !error) {
    return null;
  }

  return (
    // GestureHandlerRootView: needed once, at the very top, for drag gestures to work
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Clock and battery icons: dark on light backgrounds, light on dark ones */}
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* AuthProvider: knows who's signed in. Everything below can call useAuth(). */}
      <AuthProvider>
        {/* HouseholdProvider: which household you're in. Needs useAuth(), so it goes inside. */}
        <HouseholdProvider>
          {/* The rest each need to know your household. The order matters where one
              uses another: putting shopping away records spending (Budget) and fills the
              pantry (Pantry); cooking a recipe uses the pantry and the shopping list. */}
          {/* FoodIconsProvider: drawings the household picked for foods */}
          <FoodIconsProvider>
            <BudgetProvider>
              <PantryProvider>
                <ShoppingProvider>
                  <RecipesProvider>
                    {/* Your private calorie log. Only needs useAuth(), not the household. */}
                    {/* Recipes shared with everyone. Uses useRecipes(), so it goes inside. */}
                    <CommunityProvider>
                      <NutritionProvider>
                        {/* Expiry reminders: plans notifications from every household */}
                        <RemindersProvider>
                          {/* Cuisines you like, and whether you've done the setup flow */}
                          <PreferencesProvider>
                            <RootNavigator />
                          </PreferencesProvider>
                        </RemindersProvider>
                      </NutritionProvider>
                    </CommunityProvider>
                  </RecipesProvider>
                </ShoppingProvider>
              </PantryProvider>
            </BudgetProvider>
          </FoodIconsProvider>
        </HouseholdProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

// A separate component, because it needs useAuth(), which only works *inside* <AuthProvider>.
function RootNavigator() {
  const { session, loading: authLoading, recovering } = useAuth();
  const { household, loading: householdLoading } = useHousehold();
  const { prefs, loading: prefsLoading } = usePreferences();

  const signedIn = session !== null;
  const hasHousehold = household !== null;
  // Still working out where to send you?
  const loading = authLoading || (signedIn && (householdLoading || prefsLoading));
  const setUp = prefs.onboarded; // been through the setup flow (or skipped it)

  // The animated launch screen sits on top of everything (it hides the phone's
  // own splash once it has drawn) and fades away once we know where to send you.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {recovering ? (
        // Opened from a password-reset email: choose a new password before anything else
        <SetNewPassword />
      ) : loading ? null : (
        <Screens signedIn={signedIn} hasHousehold={hasHousehold} setUp={setUp} />
      )}
      <LaunchSplash ready={!loading || recovering} />
    </View>
  );
}

// All the app's screens, and which ones you can reach right now
function Screens({
  signedIn,
  hasHousehold,
  setUp,
}: {
  signedIn: boolean;
  hasHousehold: boolean;
  setUp: boolean;
}) {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.heading, color: colors.text },
        headerShadowVisible: false,
        headerTintColor: colors.primary, // the back arrow and header buttons
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* The app itself: signed in, in a household, and set up.
          If either stops being true, you're sent to the right screen automatically. */}
      <Stack.Protected guard={signedIn && hasHousehold && setUp}>
        {/* The five tabs live in the (tabs) folder. They draw their own headers,
            so the Stack's header is hidden here to avoid showing two. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* One item's detail page, e.g. /item/8. The title is set by the screen itself. */}
        <Stack.Screen name="item/[id]" options={{ title: "", headerBackTitle: "Back" }} />
        {/* Slides up over the tabs as a modal. Swipe down (iOS) or press back (Android) to close. */}
        <Stack.Screen name="add-item" options={{ presentation: "modal", title: "Add item" }} />
        <Stack.Screen
          name="edit-item/[id]"
          options={{ presentation: "modal", title: "Edit item" }}
        />
        <Stack.Screen name="spending" options={{ title: "Spending", headerBackTitle: "Back" }} />
        <Stack.Screen
          name="insights-details"
          options={{ title: "Food", headerBackTitle: "Insights" }}
        />
        <Stack.Screen name="recipe/[id]" options={{ title: "", headerBackTitle: "Back" }} />
        <Stack.Screen name="recipe-edit" options={{ presentation: "modal", title: "Recipe" }} />
        <Stack.Screen name="community/[id]" options={{ title: "", headerBackTitle: "Back" }} />
        {/* One pantry shelf: slides in from the right (the normal push animation) */}
        <Stack.Screen name="shelf/[key]" options={{ title: "", headerBackTitle: "Pantry" }} />
        <Stack.Screen
          name="activity/index"
          options={{ title: "All activity", headerBackTitle: "Home" }}
        />
        <Stack.Screen name="activity/[id]" options={{ presentation: "modal", title: "Change" }} />
        <Stack.Screen name="cook/[id]" options={{ presentation: "modal", title: "Cooked it" }} />
        <Stack.Screen name="account" options={{ presentation: "modal", title: "Profile" }} />
        <Stack.Screen name="avatar" options={{ presentation: "modal", title: "Profile picture" }} />
        <Stack.Screen
          name="add-password"
          options={{ presentation: "modal", title: "Email and password" }}
        />
        <Stack.Screen name="legal/[doc]" options={{ title: "", headerBackTitle: "Back" }} />
        <Stack.Screen name="put-away" options={{ presentation: "modal", title: "Put away" }} />
        <Stack.Screen name="household/[id]" options={{ title: "", headerBackTitle: "Back" }} />
        <Stack.Screen
          name="household-add"
          options={{ presentation: "modal", title: "Add a household" }}
        />
        <Stack.Screen name="calories" options={{ title: "Calories", headerBackTitle: "Back" }} />
        <Stack.Screen name="food-add" options={{ presentation: "modal", title: "Add food" }} />
        <Stack.Screen
          name="food-icon"
          options={{ presentation: "modal", title: "Choose a picture" }}
        />
        <Stack.Screen
          name="nutrition-goals"
          options={{ presentation: "modal", title: "Daily goals" }}
        />
        <Stack.Screen
          name="food-preferences"
          options={{ presentation: "modal", title: "Food preferences" }}
        />
        <Stack.Screen
          name="setup-goals"
          options={{ presentation: "modal", title: "Suggest goals" }}
        />
      </Stack.Protected>

      {/* In a household, but haven't done the quick setup yet (shown once) */}
      <Stack.Protected guard={signedIn && hasHousehold && !setUp}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Signed in, but not in a household yet: create or join one */}
      <Stack.Protected guard={signedIn && !hasHousehold}>
        <Stack.Screen name="household-setup" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Only reachable when signed OUT. Signing in moves you to the tabs automatically. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

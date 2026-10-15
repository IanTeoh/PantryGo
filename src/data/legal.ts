// ---------------------------------------------------------------------------
// The legal pages: terms, privacy, licences and account deletion.
// Shown in the app (src/app/legal/[doc].tsx) and turned into public web pages
// for the app stores by:  npx tsx scripts/build-legal-pages.mts  (→ docs/ folder)
//
// DRAFTS. These describe what PantryGo actually does with data, in plain language,
// but they aren't legal advice. Have them checked before releasing to the public.
// No imports here, so the web page script can read this file on its own.
// ---------------------------------------------------------------------------

export type LegalDoc = {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
};

// ↓ Put your real contact email here before publishing. It shows in the app
// (Profile → About) and on the public web pages. Leave it as-is to hide the
// "Contact us" row in the app.
export const CONTACT_EMAIL = "pantrygosupport@gmail.com";
export const hasContactEmail = () => !CONTACT_EMAIL.startsWith("[");
const CONTACT = CONTACT_EMAIL;

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    title: "Terms of use",
    updated: "October 2026",
    sections: [
      {
        heading: "Using PantryGo",
        body: [
          "PantryGo helps you keep track of food at home, share a pantry and shopping list with the people you live with, find recipes, and split shared costs.",
          "You need an account to use it. Keep your password to yourself; you're responsible for what happens on your account.",
        ],
      },
      {
        heading: "Households",
        body: [
          "Anyone with a household's invite code can join it and see and change its pantry, shopping list, activity and (if it's turned on) spending. Only share the code with people you trust.",
          "Anyone in a household can turn shared features like spending on or off for everyone in it. Your recipes, calorie log and settings stay your own.",
        ],
      },
      {
        heading: "Shared recipes",
        body: [
          "If you share a recipe with everyone, other PantryGo users can see it, save a copy and see your first name. Only share recipes you're allowed to share: your own, or ones you've rewritten in your own words, with credit to where they came from.",
          "Shared recipes reported by several people may be hidden, and a recipe you report is hidden for you straight away. You can also block someone so you don't see anything they share.",
          "Don't post anything offensive, unsafe or unrelated to food, including in recipe photos. We may remove content or accounts that break these rules.",
        ],
      },
      {
        heading: "Estimates, not advice",
        body: [
          "Use-by reminders, calorie and nutrition numbers, and food matches are estimates to help you, not professional advice. Always check labels and use your own judgement about whether food is safe to eat.",
          "Spending and 'who owes whom' are worked out from what people enter. PantryGo doesn't move any money; settle up between yourselves.",
        ],
      },
      {
        heading: "Changes and ending",
        body: [
          "PantryGo is a personal project and may change, have bugs, or stop. We'll try to give notice before big changes.",
          "You can delete your account at any time from your profile.",
          `Questions: ${CONTACT}`,
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    updated: "October 2026",
    sections: [
      {
        heading: "What we keep",
        body: [
          "Your account: your email address, the name you choose and, if you add one, your profile picture.",
          "If you sign in with Apple or Google, we get your name, email address and (from Google) your profile picture from them. With Apple you can choose to hide your real email address. We never see your Apple or Google password.",
          "Household data: pantry items, the activity log (who changed what, and when), the shopping list, costs, the food pictures you choose, and the household's picture. Everyone in the household can see these.",
          "Your recipes and saved foods. These are yours: people in your household don't see them unless you share a recipe with everyone.",
          "Photos you add to recipes. These are stored as image files that anyone with the photo's exact link could open (the links are long and random), so don't use them for anything private.",
          "Your calorie log, nutrition goals and food preferences. These are private: nobody else can see them, not even people in your household.",
          "People you've blocked and recipes you've reported. These are private, and only used to hide things for you and to review reports.",
          "Settings like dark mode, reminder times and food pictures are kept only on your phone.",
        ],
      },
      {
        heading: "Who can see it",
        body: [
          "People in your households see that household's data, your name and your profile picture.",
          "Recipes you choose to share with everyone are visible to all PantryGo users, with your first name and the recipe's photo.",
          "Nobody else. We don't sell your data and there are no ads or tracking.",
        ],
      },
      {
        heading: "Where it's stored",
        body: [
          "Data is stored with Supabase, a database service, and protected by rules that only let each person reach their own households and private data.",
          "Profile and household pictures are stored as image files that anyone with the picture's exact link could open (the links are long and random).",
          "Sign-up and password-reset codes are emailed to you using Google's Gmail service, so Google handles your email address to deliver them.",
          "When you scan a barcode, the barcode number (not your name or anything about you) is looked up in Open Food Facts, a free public food database.",
          "Reminders are scheduled on your phone; nothing about them is sent anywhere.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "Turn reminders off at any time in your profile, or in your phone's settings.",
          "Leave a household to stop sharing with it. Things you added stay with the household.",
          "Delete your account from your profile. This removes your account, your profile picture, your recipes, your calorie log, goals and saved foods, and recipes you shared. Recipe photos may stay where other people saved a copy of a recipe you shared. Household items and costs you added stay with the household for the others, no longer linked to you. Households where you're the only member are deleted.",
          `Questions or requests: ${CONTACT}`,
        ],
      },
    ],
  },
  licences: {
    title: "Open-source licences",
    updated: "October 2026",
    sections: [
      {
        heading: "Food drawings",
        body: [
          "Noto Emoji by Google, used under the Apache License 2.0 (https://github.com/googlefonts/noto-emoji). Provided via Iconify.",
        ],
      },
      {
        heading: "Fonts",
        body: [
          "Bricolage Grotesque and Figtree, used under the SIL Open Font License 1.1, via Google Fonts.",
        ],
      },
      {
        heading: "Data",
        body: [
          "Product information from Open Food Facts (https://world.openfoodfacts.org), available under the Open Database License. Typical nutrition values are rounded from standard food composition tables.",
        ],
      },
      {
        heading: "Software",
        body: [
          "Built with React Native, Expo, Supabase, React Native Reanimated, React Native Gesture Handler, React Native SVG and other open-source libraries, each under its own licence (mostly MIT).",
        ],
      },
    ],
  },
  "delete-account": {
    title: "Delete your PantryGo account",
    updated: "October 2026",
    sections: [
      {
        heading: "In the app (quickest)",
        body: [
          "Open PantryGo, tap the circle with your initial in the top corner, scroll to Account and tap Delete account. You'll be asked to confirm. Your account is deleted straight away.",
        ],
      },
      {
        heading: "Without the app",
        body: [
          `Email ${CONTACT} from the email address you signed up with, with the subject "Delete my account". We'll delete it within 30 days and reply to confirm.`,
        ],
      },
      {
        heading: "What's deleted",
        body: [
          "Your account and sign-in, your name and profile picture, your recipes, your calorie log, nutrition goals and saved foods, your food preferences, the people you've blocked, and recipes you've shared with everyone.",
          "Households where you're the only member are deleted, with everything in them. In households you share, the owner role passes to the next person, and pantry items, shopping, activity and costs you added stay for the others without your name on them.",
          "Recipe photos may stay where someone else saved a copy of a recipe you shared.",
        ],
      },
    ],
  },
};

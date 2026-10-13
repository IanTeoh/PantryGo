// ---------------------------------------------------------------------------
// Suggesting daily calorie and macro goals from someone's details.
//
// Uses the Mifflin-St Jeor equation (a standard estimate of the energy your
// body uses at rest), multiplied by how active you are. Deliberately gentle:
//   - losing: at most 500 kcal (or 15%) below what you use, never below your resting needs
//   - gaining: at most 400 kcal (or 10%) above
//   - no weight-loss targets for under-18s or anyone already underweight
// These are estimates, and the app says so. Nothing here is stored: only the
// resulting goals are saved.
// ---------------------------------------------------------------------------

export type Sex = "female" | "male" | "unspecified";
export type Activity = "sitting" | "light" | "active" | "very";
export type Aim = "lose" | "maintain" | "gain";

export type BodyDetails = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  aim: Aim;
};

export type GoalSuggestion =
  | {
      ok: true;
      kcal: number;
      protein: number; // grams
      carbs: number;
      fat: number;
      usedAim: Aim; // may differ from what was asked (see notes)
      notes: string[];
    }
  | { ok: false; reason: string };

export const ACTIVITY_OPTIONS: { value: Activity; label: string; hint: string }[] = [
  { value: "sitting", label: "Mostly sitting", hint: "Desk, study, little exercise" },
  { value: "light", label: "Lightly active", hint: "Walking, exercise 1–3 days a week" },
  { value: "active", label: "Active", hint: "Exercise 3–5 days a week" },
  { value: "very", label: "Very active", hint: "Hard exercise or a physical job most days" },
];

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sitting: 1.2,
  light: 1.375,
  active: 1.55,
  very: 1.725,
};

const round10 = (n: number) => Math.round(n / 10) * 10;

export function suggestGoals(d: BodyDetails): GoalSuggestion {
  if (!(d.age >= 13 && d.age <= 100))
    return { ok: false, reason: "Enter an age between 13 and 100." };
  if (!(d.heightCm >= 120 && d.heightCm <= 230))
    return { ok: false, reason: "Enter a height between 120 and 230 cm." };
  if (!(d.weightKg >= 30 && d.weightKg <= 300))
    return { ok: false, reason: "Enter a weight between 30 and 300 kg." };
  if (d.age < 18) {
    return {
      ok: false,
      reason:
        "We don't suggest calorie targets for under-18s: growing bodies need different amounts, and they change a lot. A GP or school nurse can help if you'd like a goal.",
    };
  }

  const notes: string[] = [];
  const h = d.heightCm / 100;
  const bmi = d.weightKg / (h * h);

  // Resting energy (kcal a day). "Unspecified" sits halfway between the two formulas.
  const sexTerm = d.sex === "male" ? 5 : d.sex === "female" ? -161 : -78;
  const resting = 10 * d.weightKg + 6.25 * d.heightCm - 5 * d.age + sexTerm;
  const everyday = resting * ACTIVITY_FACTOR[d.activity];

  let aim = d.aim;
  if (aim === "lose" && bmi < 18.5) {
    aim = "maintain";
    notes.push(
      "Your weight is already on the lower side for your height, so this goal is for keeping steady rather than losing.",
    );
  }

  let kcal = everyday;
  if (aim === "lose") kcal = everyday - Math.min(500, everyday * 0.15);
  if (aim === "gain") kcal = everyday + Math.min(400, everyday * 0.1);
  if (kcal < resting) {
    kcal = resting; // never below what your body needs at rest
    notes.push("Kept at your resting needs, so it's never too low.");
  }
  kcal = round10(kcal);

  // Protein by body weight (a steadier reference weight for higher BMIs)
  const refWeight = bmi > 30 ? 27 * h * h : d.weightKg;
  const protein = Math.round(refWeight * (aim === "maintain" ? 1.2 : 1.6));
  const fat = Math.round((kcal * 0.3) / 9); // about 30% of calories
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  notes.push(
    "This is an estimate to start from. Everyone's different, so adjust it if it doesn't feel right, and talk to a GP or dietitian for advice that's about you.",
  );
  return { ok: true, kcal, protein, carbs, fat, usedAim: aim, notes };
}

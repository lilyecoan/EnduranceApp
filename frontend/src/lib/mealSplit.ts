/**
 * Spreads the day's carb and protein targets across meals. A suggested split
 * (not a dietitian's meal plan): training days add a pre-workout snack and a
 * recovery meal (about 1 g/kg carbs + 0.3 g/kg protein, ISSN nutrient timing).
 */
export type Meal = { name: string; when: string; carbs_g: number; protein_g: number; ideas: string };

type Diet = { glutenFree: boolean; vegetarian: boolean; vegan: boolean; dairyFree: boolean; nutFree: boolean };

export function dietFrom(text: string | null | undefined): Diet {
  const t = (text || "").toLowerCase();
  const vegan = /\bvegan\b/.test(t);
  return {
    glutenFree: /gluten|celiac|coeliac/.test(t),
    vegan,
    vegetarian: vegan || /vegetarian|no meat|plant[- ]based/.test(t),
    dairyFree: vegan || /dairy|lactose|milk allerg/.test(t),
    nutFree: /\bnut\b|nuts|peanut|tree nut/.test(t),
  };
}

function ideas(meal: string, d: Diet): string {
  const grain = d.glutenFree ? "certified GF oats or rice" : "oats or whole-grain toast";
  const bread = d.glutenFree ? "rice cakes" : "toast or a bagel";
  const protein = d.vegan ? "tofu, tempeh or lentils" : d.vegetarian ? "eggs, tofu or Greek yogurt" : "chicken, fish or eggs";
  const dairy = d.dairyFree ? "a dairy-free yogurt" : "Greek yogurt";
  const spread = d.nutFree ? "seed butter" : "nut butter";
  switch (meal) {
    case "Breakfast": return `${grain}, fruit, ${d.vegan ? "soy milk" : d.dairyFree ? "eggs" : "eggs or yogurt"}`;
    case "Pre-workout": return `banana or ${bread} with honey; keep fat and fiber low`;
    case "Recovery": return `${d.dairyFree ? "a dairy-free" : "a milk-based"} recovery shake or ${dairy} with fruit and ${grain}`;
    case "Lunch": return `rice, potatoes or ${d.glutenFree ? "GF pasta" : "pasta"}, ${protein}, vegetables`;
    case "Snack": return `${dairy} or fruit with ${spread}`;
    default: return `${protein}, a starch (rice, potatoes${d.glutenFree ? ", GF pasta" : ", pasta"}), vegetables, olive oil`;
  }
}

export function splitMeals(
  carbs: number, protein: number, opts: { training: boolean; weightKg: number | null; preCarbs: number | null; diet: Diet },
): Meal[] {
  const plan: { name: string; when: string; c: number; p: number }[] = opts.training
    ? [
      { name: "Breakfast", when: "Morning", c: 0.2, p: 0.2 },
      { name: "Pre-workout", when: "1–2 h before training", c: 0, p: 0 },
      { name: "Recovery", when: "Within 1 h after training", c: 0, p: 0 },
      { name: "Lunch", when: "Midday", c: 0.25, p: 0.25 },
      { name: "Snack", when: "Afternoon", c: 0.1, p: 0.15 },
      { name: "Dinner", when: "Evening", c: 0.25, p: 0.25 },
    ]
    : [
      { name: "Breakfast", when: "Morning", c: 0.25, p: 0.25 },
      { name: "Lunch", when: "Midday", c: 0.3, p: 0.3 },
      { name: "Snack", when: "Afternoon", c: 0.15, p: 0.15 },
      { name: "Dinner", when: "Evening", c: 0.3, p: 0.3 },
    ];
  const w = opts.weightKg ?? 70;
  const pre = opts.training ? opts.preCarbs ?? 40 : 0;
  const recC = opts.training ? Math.round(w * 1.0) : 0;
  const recP = opts.training ? Math.round(w * 0.3) : 0;
  const restC = Math.max(0, carbs - pre - recC);
  const restP = Math.max(0, protein - recP);
  const share = plan.reduce((s, m) => s + m.c, 0) || 1;
  const shareP = plan.reduce((s, m) => s + m.p, 0) || 1;
  return plan.map((m) => ({
    name: m.name,
    when: m.when,
    carbs_g: m.name === "Pre-workout" ? pre : m.name === "Recovery" ? recC : Math.round((restC * m.c) / share),
    protein_g: m.name === "Pre-workout" ? 0 : m.name === "Recovery" ? recP : Math.round((restP * m.p) / shareP),
    ideas: ideas(m.name, opts.diet),
  }));
}

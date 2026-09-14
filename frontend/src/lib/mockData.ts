// Demo/fixture Garmin snapshot — used when no live Garmin connection is available.
export const mockGarminData = {
  hrv_rmssd: 81,
  hrv_baseline: 46,
  hrv_status: "BALANCED",
  hrv_5day_avg: 62,
  sleep_score: 84,
  sleep_duration_seconds: 27780,   // 7h 43m
  body_battery_morning: 65,
  body_battery_high: 65,
  stress_avg: 24,
  training_readiness_score: 82,    // derived: high HRV + good sleep
  recovery_time_hours: 10,
  ctl: 28,
  atl: 30,
  tsb: -2,
  acute_load: 160,
  vo2_max: 47.2,
  ftp: 128,
  run_threshold_pace: 415,         // sec/km threshold (~11:08/mi after conversion)
  swim_pace_per_100yd: 110,        // 1:50/100yd
  resting_hr: 56,
  weight_kg: 63.5,
};

export const mockRecoveryHistory = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  hrv: 50 + Math.round(Math.random() * 35 - 10),
  sleep: 70 + Math.round(Math.random() * 18 - 4),
  readiness: 65 + Math.round(Math.random() * 20 - 4),
  bodyBattery: 60 + Math.round(Math.random() * 18 - 5),
}));

export const mockCTLHistory = Array.from({ length: 16 }, (_, i) => ({
  week: `W${i + 1}`,
  ctl: Math.round(14 + i * 1.0 + Math.random() * 2),
  atl: Math.round(12 + i * 0.9 + Math.random() * 5 - 2),
  tsb: Math.round(-2 + Math.random() * 8 - 4),
}));

// FTP zones for 128W:
// Z1 Active Recovery: < 77W  (< 60%)
// Z2 Endurance:       77–102W  (60–80%)
// Z3 Tempo:           102–115W (80–90%)
// Sweet Spot:         109–122W (85–95%)
// Z4 Threshold:       115–134W (90–105%)
// Z5 VO₂ Max:         134–154W (105–120%)
export const mockWeeklyPlan = [
  {
    day: "Mon",
    date: "Aug 3",
    workout: {
      type: "technique",
      sport: "Swim",
      name: "Technique & Pull Buoy",
      duration_min: 40,
      distance_yards: 1200,
      intensity: "Zone 2",
      tss: 30,
      notes: "200yd WU → 4×50yd kickboard → 4×50yd pull buoy (add paddles if available) → 4×100yd descend pace → 200yd CD. Pull buoy isolates upper body to groove your catch.",
    },
    strength: {
      name: "Lower Body + Mobility",
      focus: "lower",
      duration_min: 35,
      tss: 22,
      notes: "Warmup: hip flexor mobility 20s/side · crab walks 30s · inchworm ×8 · bodyweight squat ×10. Main: Goblet Squat 3×12 · Romanian Deadlift 3×10 · Bulgarian Split Squat 3×10/leg · Single-Leg Hip Thrust 3×12 · Lateral Band Walks 2×25 steps. Mobility finisher: couch stretch 45s/side · figure-4 glute 45s/side · hamstring 30s/side.",
    },
  },
  {
    day: "Tue",
    date: "Aug 4",
    workout: {
      type: "tempo",
      sport: "Bike",
      name: "Sweet Spot Bike",
      duration_min: 60,
      distance_mi: 16.2,
      intensity: "Zone 3–4",
      tss: 62,
      notes: "2×15min at 85–95% FTP (109–122W). 5min easy spin between.",
    },
  },
  {
    day: "Wed",
    date: "Aug 5",
    workout: {
      type: "intervals",
      sport: "Swim",
      name: "Swim Intervals",
      duration_min: 45,
      distance_yards: 1500,
      intensity: "Zone 3",
      tss: 42,
      notes: "200yd WU → 100yd pull buoy easy → 8×100yd (75yd Zone 3 / 25yd easy, :20 rest) → 4×50yd fast → 200yd CD. Focus on holding form when tired — quality over speed.",
    },
  },
  {
    day: "Thu",
    date: "Aug 6",
    workout: {
      type: "endurance",
      sport: "Run",
      name: "Easy Aerobic Run",
      duration_min: 40,
      distance_mi: 3.4,
      intensity: "Zone 2",
      tss: 28,
      notes: "All Zone 2 (HR 118–147bpm). Running stays present but reduced while swim volume builds.",
    },
  },
  {
    day: "Fri",
    date: "Aug 7",
    workout: null,
    rest: true,
  },
  {
    day: "Sat",
    date: "Aug 8",
    workout: {
      type: "long",
      sport: "Bike",
      name: "Base Long Ride",
      duration_min: 90,
      distance_mi: 23.6,
      intensity: "Zone 2",
      tss: 78,
      notes: "Zone 2 throughout (77–102W). Key session of the week. Practice race nutrition every 20min. This is your longest aerobic effort.",
      fueling: { carbs_per_hour: 60, water_oz_per_hour: 24, sodium_mg_per_hour: 750 },
    },
  },
  {
    day: "Sun",
    date: "Aug 9",
    workout: {
      type: "endurance",
      sport: "Swim",
      name: "Aerobic Endurance Swim",
      duration_min: 45,
      distance_yards: 1400,
      intensity: "Zone 2",
      tss: 35,
      notes: "200yd WU → 2×50yd pull buoy → 3×300yd steady Zone 2 (~1:55/100yd) → 150yd easy CD. Longest swim of the week — keep it easy and sustainable.",
    },
    strength: {
      name: "Full Body Strength",
      focus: "full",
      duration_min: 35,
      tss: 25,
      notes: "Warmup: arm circles · ITYW shoulder drill 6 reps/position · inchworm ×8. Main: Dumbbell Thrusters 3×10 · Single-Leg RDL 3×10/leg · Renegade Row + Push-Up 3×8/side · Step-Ups 3×12/leg · Lat Pull-Down 3×12 · Plank 3×30s + Bird Dog 3×8/side. Core finisher: side plank 30s/side · dead bug ×10/side.",
    },
  },
];

export const mockNutritionDay = {
  daily_calories: 2320,
  protein_g: 102,
  carbs_g: 310,
  fat_g: 76,
  hydration_oz_per_hour: 24,
  sodium_mg_per_hour: 750,
  fueling_timeline: [
    { time: "7:00am", item: "Rice cakes + eggs + avocado", carbs_g: 45, protein_g: 20 },
    { time: "10:00am", item: "Pre-workout: banana + 15g almond butter", carbs_g: 28, protein_g: 4 },
    { time: "10:30am", item: "During bike: gel every 20min + water", carbs_g: 60, protein_g: 0 },
    { time: "12:30pm", item: "Post-workout: rice + grilled salmon + steamed veggies", carbs_g: 65, protein_g: 38 },
    { time: "3:00pm", item: "Greek yogurt + berries + granola", carbs_g: 35, protein_g: 18 },
    { time: "6:30pm", item: "Sweet potato + chicken + olive oil + leafy greens", carbs_g: 55, protein_g: 35 },
    { time: "9:00pm", item: "Casein protein shake + almond butter", carbs_g: 10, protein_g: 22 },
  ],
};

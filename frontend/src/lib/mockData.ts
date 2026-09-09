// Lily Coan — IronMind AI profile
// Weight: 140 lbs · FTP: 128W (2.01 W/kg) · VO₂max: 47.2
// Race: Ironman 70.3 Galveston, April 4, 2027 (~34 weeks from Aug 2026)
// Medical: T1D · Celiac · Hashimoto's · Rheumatoid Arthritis
// Units: customary (miles, lbs, °F, fl oz)

export const mockAthleteProfile = {
  name: "Lily Coan",
  age: 22,
  weight_lb: 140,
  weight_kg: 63.5,
  ftp_watts: 128,
  watts_per_kg: 2.01,
  vo2_max: 47.2,
  max_hr: 196,
  lactate_threshold_hr: 170,
  resting_hr: 56,
  has_type1_diabetes: true,
  has_celiac_disease: true,
  has_hashimoto: true,
  has_rheumatoid_arthritis: true,
  race_date: "2027-04-04",
  race_name: "Ironman 70.3 Galveston",
  race_distance: "half_iron",
};

// Real Garmin data as of August 8, 2026
// HRV 81ms vs baseline 46ms = +76% → HIGH READINESS day
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
      notes: "200yd WU → 4×50yd kickboard → 4×50yd pull buoy (add paddles if available) → 4×100yd descend pace → 200yd CD. Pull buoy isolates upper body to groove your catch. Check glucose before entering pool (T1D).",
    },
    strength: {
      name: "Lower Body + Mobility",
      focus: "lower",
      duration_min: 35,
      tss: 22,
      notes: "Warmup: hip flexor mobility 20s/side · crab walks 30s · inchworm ×8 · bodyweight squat ×10. Main: Goblet Squat 3×12 · Romanian Deadlift 3×10 · Bulgarian Split Squat 3×10/leg · Single-Leg Hip Thrust 3×12 · Lateral Band Walks 2×25 steps. Mobility finisher: couch stretch 45s/side · figure-4 glute 45s/side · hamstring 30s/side. RA: bodyweight only on flare days — never push through joint pain.",
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
      notes: "2×15min at 85–95% FTP (109–122W). 5min easy spin between. Stay seated to protect knees (RA). HRV elevated today — make this session count.",
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
      notes: "All Zone 2 (HR 118–147bpm). Running stays present but reduced to protect RA joints while swim volume builds. Joints check: any flare → cut to 20min or skip.",
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
      notes: "Zone 2 throughout (77–102W). Key session of the week. Practice race nutrition every 20min — verified GF products only. This is your longest aerobic effort.",
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
      notes: "200yd WU → 2×50yd pull buoy → 3×300yd steady Zone 2 (~1:55/100yd) → 150yd easy CD. Longest swim of the week — keep it easy and sustainable. Building your base for the 1.2mi race swim.",
    },
    strength: {
      name: "Full Body Strength",
      focus: "full",
      duration_min: 35,
      tss: 25,
      notes: "Warmup: arm circles · ITYW shoulder drill 6 reps/position · inchworm ×8. Main: Dumbbell Thrusters 3×10 · Single-Leg RDL 3×10/leg · Renegade Row + Push-Up 3×8/side · Step-Ups 3×12/leg · Lat Pull-Down 3×12 · Plank 3×30s + Bird Dog 3×8/side. Core finisher: side plank 30s/side · dead bug ×10/side. RA: skip overhead press on shoulder flare days — substitute lat pull-down.",
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
  // All items are gluten-free (celiac). Anti-inflammatory focus (RA + Hashimoto's).
  fueling_timeline: [
    { time: "7:00am", item: "GF rice cakes + eggs + avocado (celiac-safe)", carbs_g: 45, protein_g: 20 },
    { time: "10:00am", item: "Pre-workout: GF banana + 15g almond butter", carbs_g: 28, protein_g: 4 },
    { time: "10:30am", item: "DURING bike: GF gel every 20min + water", carbs_g: 60, protein_g: 0 },
    { time: "12:30pm", item: "Post-workout: rice + grilled salmon + steamed veggies", carbs_g: 65, protein_g: 38 },
    { time: "3:00pm", item: "GF Greek yogurt + berries + GF granola (check label)", carbs_g: 35, protein_g: 18 },
    { time: "6:30pm", item: "Sweet potato + chicken + olive oil + leafy greens", carbs_g: 55, protein_g: 35 },
    { time: "9:00pm", item: "Casein protein shake (verified GF) + almond butter", carbs_g: 10, protein_g: 22 },
  ],
};

// Galveston 70.3 — flat/fast course, March conditions (~65°F, possible Gulf wind)
export const mockRaceData = {
  race_date: "2027-04-04",
  race_name: "Ironman 70.3 Galveston",
  predicted_finish_seconds: 24720,  // ~6:52:00
  swim_pace_per_100yd: 110,         // 1:50/100yd
  bike_watts_target: 97,            // 76% of 128W FTP
  run_pace_target: 435,             // sec/km (~11:40/mi after conversion)
  split_targets: {
    swim_seconds: 2280,    // 38min
    t1_seconds: 240,
    bike_seconds: 12960,   // 3h36min
    t2_seconds: 180,
    run_seconds: 9180,     // 2h33min
  },
};

export const mockPerformanceTrends = Array.from({ length: 12 }, (_, i) => ({
  month: new Date(2025, 8 + i, 1).toLocaleDateString("en-US", { month: "short" }),
  ftp: Math.round(108 + i * 1.8 + Math.random() * 3),
  vo2max: Math.round((42 + i * 0.28 + Math.random() * 0.4) * 10) / 10,
  runPace: Math.round(450 - i * 3 + Math.random() * 8),
}));

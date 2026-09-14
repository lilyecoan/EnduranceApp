export type RecoveryOutput = {
  score: number | null;
  status: string;
  hrv_rmssd: number | null;
  hrv_trend: string | null;
  sleep_score: number | null;
  body_battery: number | null;
  stress_level: number | null;
  recovery_time_hours: number | null;
  recommendation: string;
  is_high_readiness: boolean;
  is_low_readiness: boolean;
};

export type NutritionOutput = {
  has_scheduled_workout: boolean;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  pre_workout_carbs_g: number | null;
  intra_carbs_g_per_hour: number | null;
  hydration_ml_per_hour: number;
  sodium_mg_per_hour: number;
  reasoning: string;
};

export type TrainingLoadOutput = {
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  acute_load: number | null;
  load_status: string;
  risk_level: string;
  recommendation: string;
  training_phase: string;
  can_progress: boolean;
  should_reduce: boolean;
};

export type PerformanceOutput = {
  swim_level: string;
  bike_level: string;
  run_level: string;
  primary_limiter: string;
  ftp_trend: string | null;
  vo2_max_trend: string | null;
  fitness_trajectory: string;
  predicted_race_finish: number | null;
};

export type RaceStrategyOutput = {
  swim_pace_per_100m: number | null;
  bike_watts_target: number | null;
  run_pace_target: number | null;
  predicted_finish_seconds: number | null;
  fueling_plan: Record<string, unknown>[];
  taper_notes: string | null;
  key_race_notes: string[];
};

export type CoachingPlan = {
  date: string;
  recovery: RecoveryOutput | null;
  training_load: TrainingLoadOutput | null;
  performance: PerformanceOutput | null;
  nutrition: NutritionOutput | null;
  diabetes: Record<string, unknown> | null;
  weather: Record<string, unknown> | null;
  race_strategy: RaceStrategyOutput | null;
  today_recommendation: string;
  today_workout: Record<string, unknown> | null;
  weekly_plan: Record<string, unknown>[];
  key_messages: string[];
  confidence: number;
};

export type CoachingRunResult = {
  plan: CoachingPlan | null;
  errors: string[];
  garminSource: "live" | "demo" | "unknown";
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

/**
 * Runs the real, authenticated coaching pipeline. Replaces every hardcoded
 * <CoachCard message="..."> literal that used to appear across the app —
 * the recommendation text, confidence, and key messages shown to the user
 * now always come from this backend response (including its honest
 * "insufficient data" / "AI coaching narrative unavailable" states),
 * never a static string.
 */
export async function runCoachingPipeline(token: string | null): Promise<CoachingRunResult> {
  if (!token) {
    return { plan: null, errors: ["Not signed in"], garminSource: "unknown" };
  }
  try {
    const res = await fetch(`${BACKEND}/api/v1/coaching/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Coaching API ${res.status}`);
    const raw = await res.json();
    return {
      plan: raw.plan ?? null,
      errors: raw.errors ?? [],
      garminSource: raw.garmin_source ?? "unknown",
    };
  } catch (err) {
    return {
      plan: null,
      errors: [err instanceof Error ? err.message : "Unknown error"],
      garminSource: "unknown",
    };
  }
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type RaceConditions = {
  basis: "forecast" | "historical";
  years: number[];
  start_temp_c: number | null;
  peak_temp_c: number | null;
  peak_feels_like_c: number | null;
  avg_humidity_pct: number | null;
  avg_wind_kph: number | null;
  rain_chance_pct: number | null;
  sunrise: string | null;
};

export type TimelineEntry = {
  offset_min: number;
  clock: string;
  phase: string;
  title: string;
  detail: string;
  carbs_g: number;
  fluid_ml: number;
  sodium_mg: number;
  caffeine_mg: number;
};

export type NutritionPlan = {
  race_type: string;
  start_time: string;
  start_time_assumed: boolean;
  expected_finish_minutes: number;
  finish_basis: "goal" | "pace" | "typical";
  legs: { name: string; start_offset_min: number; duration_min: number; carbs_g_per_hr: number; fluid_ml_per_hr: number; sodium_mg_per_hr: number }[];
  totals_during: { carbs_g: number; fluid_ml: number; sodium_mg: number; caffeine_mg: number };
  rates: { carbs_g_per_hr: number; fluid_ml_per_hr: number; sodium_mg_per_hr: number };
  timeline: TimelineEntry[];
  adjustments: string[];
  assumptions: string[];
  health_adjustments: string[];
  health_sources: { topic: string; name: string; url: string }[];
  sources: { name: string; url: string }[];
  conditions: RaceConditions | null;
  weather_attribution: { name: string; url: string } | null;
  ai_used: boolean;
};

export type CourseInfo = {
  water_temp_c?: number | null;
  aid_station_products?: string[];
  aid_station_notes?: string | null;
  cutoffs?: string | null;
  course_notes?: string[];
  place_name?: string | null;
};

export type Race = {
  race_type: string;
  name: string;
  race_date: string;
  location: string | null;
  race_url: string | null;
  start_time: string | null; // HH:MM:SS
  goal_finish_minutes: number | null;
  swim_distance_m: number | null;
  bike_distance_km: number | null;
  run_distance_km: number | null;
  elevation_gain_m: number | null;
  is_wetsuit_legal: boolean | null;
  course_info: CourseInfo | null;
  place_name: string | null;
  venue_elevation_m: number | null;
  nutrition_plan: NutritionPlan | null;
  nutrition_plan_generated_at: string | null;
  nutrition_plan_stale: boolean;
};

export type RaceInput = Omit<Race, "place_name" | "venue_elevation_m" | "nutrition_plan" | "nutrition_plan_generated_at" | "nutrition_plan_stale">;

export type ImportedDetails = Partial<{
  name: string | null;
  race_type: string | null;
  date: string | null;
  start_time: string | null;
  location: string | null;
  swim_distance_m: number | null;
  bike_distance_km: number | null;
  run_distance_km: number | null;
  elevation_gain_m: number | null;
  water_temp_c: number | null;
  is_wetsuit_legal: boolean | null;
  aid_station_products: string[];
  aid_station_notes: string | null;
  cutoffs: string | null;
  course_notes: string[];
}>;

export type ImportResult = { details: ImportedDetails; source_url: string | null; ai_used: boolean; notices: string[] };

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${BACKEND}/api/v1/race${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Race API ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error */
    }
    throw new Error(detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const fetchRace = (token: string | null) => call<Race | null>(token, "");
export const saveRace = (token: string | null, race: RaceInput) =>
  call<Race>(token, "", { method: "PUT", body: JSON.stringify(race) });
export const removeRace = (token: string | null) => call<void>(token, "", { method: "DELETE" });
export const setTrainingGoal = (token: string | null, training_goal: string) =>
  call<void>(token, "/goal", { method: "PUT", body: JSON.stringify({ training_goal }) });
export const importRace = (token: string | null, url: string | null, pasted_text: string | null) =>
  call<ImportResult>(token, "/import", { method: "POST", body: JSON.stringify({ url, pasted_text }) });
export const generateNutritionPlan = (token: string | null) =>
  call<Race>(token, "/nutrition-plan", { method: "POST" });

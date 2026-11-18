const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type WorkoutLog = {
  id: string;
  date: string; // YYYY-MM-DD
  slot: "main" | "strength" | "extra";
  sport: string | null;
  planned_name: string | null;
  planned_duration_min: number | null;
  planned_distance_m: number | null;
  planned_load: number | null;
  status: "completed" | "skipped";
  actual_duration_min: number | null;
  actual_distance_m: number | null;
  rpe: number | null;
  avg_hr: number | null;
  notes: string | null;
  load: number;
  /** Set when this entry comes from a synced workout rather than the athlete's own log. */
  synced?: { name: string | null; source: string };
};

export type WorkoutLogInput = Omit<WorkoutLog, "id" | "load">;

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${BACKEND}/api/v1/training${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Training API ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const listLogs = (token: string | null, start: string, end: string) =>
  call<WorkoutLog[]>(token, `/logs?start=${start}&end=${end}`);

export const saveLog = (token: string | null, log: WorkoutLogInput) =>
  call<WorkoutLog>(token, "/logs", { method: "PUT", body: JSON.stringify(log) });

export const deleteLog = (token: string | null, id: string) =>
  call<void>(token, `/logs/${id}`, { method: "DELETE" });

/** A workout synced from a connected source or uploaded file. */
export type SyncedActivity = {
  id: string;
  source: string;
  sport: string; // swimming | cycling | running | strength | other
  name: string | null;
  start_time: string;
  duration_min: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  elevation_gain_m: number | null;
  load: number;
  load_from_source: boolean;
  used_for_coaching: boolean;
};

export const listActivities = (token: string | null, start: string, end: string) =>
  call<SyncedActivity[]>(token, `/activities?start=${start}&end=${end}&tz_offset_minutes=${new Date().getTimezoneOffset()}`);

export type PlanSession = {
  id: string;
  date: string;
  slot: "main" | "strength";
  sport: string; // Swim | Bike | Run | Strength | Cross | Race
  kind: string | null;
  name: string;
  intensity: string | null;
  duration_min: number;
  distance_m: number | null;
  load: number;
  description: string;
};

export type WeekPlan = {
  week_start: string;
  phase: string;
  phase_label: string;
  weeks_to_race: number | null;
  recovery_week: boolean;
  readiness_factor: number;
  planned_load: number;
  planned_hours: number;
  reasons: string[];
  notes: string[];
  inputs: { recent_weekly_load?: number | null; ctl?: number | null; goal?: string };
  generated_at: string | null;
  /** Goal, race, zones or health notes changed since this week was built. */
  stale: boolean;
  sessions: PlanSession[];
};

const tz = () => new Date().getTimezoneOffset();

export const fetchWeekPlan = (token: string | null, weekStart: string) =>
  call<WeekPlan>(token, `/plan?week_start=${weekStart}&tz_offset_minutes=${tz()}`);

export const regenerateWeekPlan = (token: string | null, weekStart: string) =>
  call<WeekPlan>(token, `/plan/regenerate?week_start=${weekStart}&tz_offset_minutes=${tz()}`, { method: "POST" });

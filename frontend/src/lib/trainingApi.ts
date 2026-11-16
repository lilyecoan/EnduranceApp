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

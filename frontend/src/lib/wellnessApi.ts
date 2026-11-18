const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type CheckIn = {
  date: string; // YYYY-MM-DD
  resting_hr: number | null;
  hrv_rmssd: number | null;
  sleep_duration_seconds: number | null;
  weight_kg: number | null;
  sleep_quality: number | null; // 1-5
  soreness: number | null; // 1-5
  energy: number | null; // 1-5
  checkin_notes: string | null;
};

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${BACKEND}/api/v1/wellness${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wellness API ${res.status}`);
  return (await res.json()) as T;
}

export const listCheckIns = (token: string | null, days = 14) => call<CheckIn[]>(token, `/checkins?days=${days}`);
export const saveCheckIn = (token: string | null, checkIn: CheckIn) =>
  call<CheckIn>(token, "/checkins", { method: "PUT", body: JSON.stringify(checkIn) });

export type HistoryDay = {
  date: string;
  resting_hr: number | null;
  hrv_rmssd: number | null;
  hrv_sdnn: number | null;
  sleep_hours: number | null;
  steps: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  sleep_quality: number | null;
  energy: number | null;
  soreness: number | null;
};

export const fetchWellnessHistory = (token: string | null, days = 30) =>
  call<HistoryDay[]>(token, `/history?days=${days}`);

export type AthleteProfile = {
  is_complete: boolean;
  full_name: string | null;
  email: string;
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  ftp_watts: number | null;
  vo2_max: number | null;
  lactate_threshold_hr: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  swim_pace_per_100m: number | null;
  run_threshold_pace: number | null;
  has_type1_diabetes: boolean;
  primary_race_name: string | null;
  primary_race_date: string | null;
  primary_race_distance: string | null;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function fetchProfile(token: string | null): Promise<AthleteProfile | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/v1/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Profile API ${res.status}`);
    return (await res.json()) as AthleteProfile;
  } catch {
    return null;
  }
}

export async function updateProfile(
  token: string | null,
  updates: Partial<AthleteProfile>
): Promise<AthleteProfile | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/v1/profile/me`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Profile API ${res.status}`);
    return (await res.json()) as AthleteProfile;
  } catch {
    return null;
  }
}

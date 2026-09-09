import { mockGarminData } from "./mockData";

export type GarminSnapshot = typeof mockGarminData;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function fetchGarminSnapshot(): Promise<GarminSnapshot> {
  const res = await fetch(`${BACKEND}/api/v1/coaching/garmin/snapshot`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Garmin API ${res.status}`);
  const raw = await res.json();

  // Merge live values over mockData fallbacks so nulls never reach the UI
  return {
    ...mockGarminData,
    ...Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== undefined)
    ),
    // Ensure vo2_max is always a plain number
    vo2_max:
      typeof raw.vo2_max === "number"
        ? raw.vo2_max
        : (raw.vo2_max as { generic?: { vo2MaxPreciseValue?: number } })?.generic
            ?.vo2MaxPreciseValue ?? mockGarminData.vo2_max,
  } as GarminSnapshot;
}

import { mockGarminData } from "./mockData";

export type GarminSnapshot = typeof mockGarminData;

export type GarminResult = {
  data: GarminSnapshot;
  source: "live" | "demo";
  asOf: string;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

/**
 * Fetch the Garmin snapshot. Never merges live and mock fields per-key —
 * the previous version filled null/undefined live fields with mockData
 * fallbacks, which let a "Live" badge display partially fabricated data.
 * The backend itself reports "source": "live" | "demo" (it falls back to
 * its own fixture when the demo Garmin login fails); on top of that, any
 * network/auth failure here also falls back to the full mock snapshot,
 * tagged "demo" the same way.
 */
export async function fetchGarminSnapshot(token: string | null): Promise<GarminResult> {
  const asOf = new Date().toISOString();
  if (!token) {
    return { data: mockGarminData, source: "demo", asOf };
  }
  try {
    const res = await fetch(`${BACKEND}/api/v1/coaching/garmin/snapshot`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Garmin API ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;
    const { source: rawSource, ...rest } = raw;
    return {
      data: rest as GarminSnapshot,
      source: rawSource === "live" ? "live" : "demo",
      asOf,
    };
  } catch {
    return { data: mockGarminData, source: "demo", asOf };
  }
}

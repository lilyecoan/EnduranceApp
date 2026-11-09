/**
 * Display units. Everything is stored metric (kg, m, sec/km, sec/100m, ml);
 * these helpers convert only for what the athlete sees and types.
 * "imperial" = US customary: lb, mi, yd, min/mi, /100yd, oz.
 */
export type Units = "imperial" | "metric";

const KG_PER_LB = 0.45359237;
const M_PER_MI = 1609.344;
const M_PER_YD = 0.9144;
const ML_PER_OZ = 29.5735;

const round1 = (n: number) => Math.round(n * 10) / 10;

function mmss(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// --- weight ---------------------------------------------------------------
export const weightUnit = (u: Units) => (u === "imperial" ? "lb" : "kg");
export const kgToDisplay = (kg: number, u: Units) => round1(u === "imperial" ? kg / KG_PER_LB : kg);
export const displayToKg = (value: number, u: Units) => round1(u === "imperial" ? value * KG_PER_LB : value);

// --- run pace (stored sec/km) ---------------------------------------------
export const runPaceUnit = (u: Units) => (u === "imperial" ? "/mi" : "/km");
export const runPaceInputLabel = (u: Units) => (u === "imperial" ? "sec/mi" : "sec/km");
export const secPerKmToDisplay = (secPerKm: number, u: Units) =>
  Math.round(u === "imperial" ? (secPerKm * M_PER_MI) / 1000 : secPerKm);
export const displayToSecPerKm = (value: number, u: Units) =>
  round1(u === "imperial" ? (value * 1000) / M_PER_MI : value);
export const formatRunPace = (secPerKm: number, u: Units) => `${mmss(secPerKmToDisplay(secPerKm, u))}${runPaceUnit(u)}`;

// --- swim pace (stored sec/100m) -------------------------------------------
export const swimPaceUnit = (u: Units) => (u === "imperial" ? "/100yd" : "/100m");
export const swimPaceInputLabel = (u: Units) => (u === "imperial" ? "sec/100yd" : "sec/100m");
export const secPer100mToDisplay = (secPer100m: number, u: Units) =>
  Math.round(u === "imperial" ? secPer100m * M_PER_YD : secPer100m);
export const displayToSecPer100m = (value: number, u: Units) =>
  round1(u === "imperial" ? value / M_PER_YD : value);
export const formatSwimPace = (secPer100m: number, u: Units) =>
  `${mmss(secPer100mToDisplay(secPer100m, u))}${swimPaceUnit(u)}`;

// --- distance ---------------------------------------------------------------
/** Long distances (runs, rides): mi / km. */
export const formatDistance = (meters: number, u: Units) =>
  u === "imperial" ? `${round1(meters / M_PER_MI)}mi` : `${round1(meters / 1000)}km`;
/** Short distances (swims): yd / m. */
export const formatShortDistance = (meters: number, u: Units) =>
  u === "imperial"
    ? `${Math.round(meters / M_PER_YD).toLocaleString()}yd`
    : `${Math.round(meters).toLocaleString()}m`;
export const milesToMeters = (mi: number) => mi * M_PER_MI;
export const yardsToMeters = (yd: number) => yd * M_PER_YD;

// --- fluid ------------------------------------------------------------------
export const formatFluidPerHour = (ml: number, u: Units) =>
  u === "imperial" ? `${Math.round(ml / ML_PER_OZ)} oz/hr` : `${Math.round(ml)} ml/hr`;
export const ozToMl = (oz: number) => oz * ML_PER_OZ;

// --- temperature (for weather displays) -------------------------------------
export const formatTemp = (celsius: number, u: Units) =>
  u === "imperial" ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;

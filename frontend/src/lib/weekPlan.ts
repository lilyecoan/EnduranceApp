/**
 * The training week as dated sessions, and how it shifts after the athlete
 * logs what they actually did.
 *
 * Rule (kept deliberately simple and explainable):
 * - Only logged sessions count; an unlogged past session is "not logged",
 *   never assumed done or missed.
 * - Did more than planned so far → the rest of the week is trimmed to absorb
 *   it, by at most 30%.
 * - Did less → the rest of the week grows by at most 10%. Missed work isn't
 *   crammed back in.
 */
import { mockWeeklyPlan } from "@/lib/mockData";
import type { WorkoutLog } from "@/lib/trainingApi";

const M_PER_MI = 1609.344;
const M_PER_YD = 0.9144;
export const MAX_CUT = 0.3;
export const MAX_ADD = 0.1;

export type Session = {
  key: string; // `${date}:${slot}`
  date: string; // YYYY-MM-DD
  day: string; // Mon..Sun
  slot: "main" | "strength";
  sport: string;
  name: string;
  intensity: string | null;
  duration_min: number;
  distance_m: number | null;
  load: number;
};

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekStart(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return d;
}

/** The example week template placed on this week's dates. */
export function buildWeek(today: Date): { dates: string[]; sessions: Session[] } {
  const monday = weekStart(today);
  const dates: string[] = [];
  const sessions: Session[] = [];
  mockWeeklyPlan.forEach((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = isoDate(d);
    dates.push(date);
    const w = day.workout;
    if (w) {
      const distance =
        "distance_mi" in w && w.distance_mi ? w.distance_mi * M_PER_MI
          : "distance_yards" in w && w.distance_yards ? w.distance_yards * M_PER_YD
            : null;
      sessions.push({
        key: `${date}:main`, date, day: day.day, slot: "main", sport: w.sport, name: w.name,
        intensity: w.intensity ?? null, duration_min: w.duration_min, distance_m: distance, load: w.tss,
      });
    }
    const s = "strength" in day ? day.strength : undefined;
    if (s) {
      sessions.push({
        key: `${date}:strength`, date, day: day.day, slot: "strength", sport: "Strength", name: s.name,
        intensity: null, duration_min: s.duration_min, distance_m: null, load: s.tss,
      });
    }
  });
  return { dates, sessions };
}

export type SessionState = {
  session: Session;
  log: WorkoutLog | null;
  /** Upcoming and unlogged: planned values scaled by the week's factor. */
  adjusted: { duration_min: number; distance_m: number | null; load: number } | null;
  notLogged: boolean;
};

export type DayLoad = { date: string; day: string; planned: number; done: number | null; adjusted: number | null };

export type WeekAdjustment = {
  states: SessionState[];
  extras: WorkoutLog[];
  days: DayLoad[];
  plannedTotal: number;
  doneTotal: number;
  /** Logged actual minus planned for the same sessions (plus unplanned extras). */
  delta: number;
  factor: number;
  message: string;
  warnings: string[];
};

const EASY = /zone 1|zone 2$|recovery|easy/i;

export function adjustWeek(dates: string[], sessions: Session[], logs: WorkoutLog[], todayIso: string): WeekAdjustment {
  const byKey = new Map(logs.map((l) => [`${l.date}:${l.slot}`, l]));
  const extras = logs.filter((l) => l.slot === "extra" && dates.includes(l.date));

  let delta = extras.reduce((s, l) => s + l.load, 0);
  let remainingPlanned = 0;
  for (const s of sessions) {
    const log = byKey.get(s.key);
    if (log) delta += log.load - s.load;
    else if (s.date >= todayIso) remainingPlanned += s.load;
  }

  let factor = 1;
  if (remainingPlanned > 0 && delta > 0) factor = Math.max(1 - MAX_CUT, 1 - delta / remainingPlanned);
  if (remainingPlanned > 0 && delta < 0) factor = Math.min(1 + MAX_ADD, 1 + -delta / remainingPlanned);
  factor = Math.round(factor * 100) / 100;

  const states: SessionState[] = sessions.map((s) => {
    const log = byKey.get(s.key) ?? null;
    const upcoming = !log && s.date >= todayIso;
    return {
      session: s,
      log,
      adjusted: upcoming && factor !== 1
        ? {
          duration_min: Math.round(s.duration_min * factor),
          distance_m: s.distance_m === null ? null : s.distance_m * factor,
          load: Math.round(s.load * factor),
        }
        : null,
      notLogged: !log && s.date < todayIso,
    };
  });

  const days: DayLoad[] = dates.map((date, i) => {
    const mine = states.filter((st) => st.session.date === date);
    const dayExtras = extras.filter((e) => e.date === date);
    const planned = mine.reduce((sum, st) => sum + st.session.load, 0);
    const logged = mine.filter((st) => st.log);
    const doneSum = logged.reduce((sum, st) => sum + (st.log?.load ?? 0), 0) + dayExtras.reduce((s, e) => s + e.load, 0);
    const hasDone = logged.length > 0 || dayExtras.length > 0;
    const upcoming = mine.filter((st) => !st.log && st.session.date >= todayIso);
    const adjustedSum = upcoming.reduce((sum, st) => sum + (st.adjusted?.load ?? st.session.load), 0);
    return {
      date,
      day: mockWeeklyPlan[i].day,
      planned,
      done: hasDone ? Math.round(doneSum) : null,
      adjusted: upcoming.length > 0 ? Math.round(adjustedSum) : null,
    };
  });

  const doneTotal = Math.round(
    states.reduce((s, st) => s + (st.log?.load ?? 0), 0) + extras.reduce((s, e) => s + e.load, 0),
  );
  const plannedTotal = sessions.reduce((s, x) => s + x.load, 0);
  const pct = Math.round(Math.abs(factor - 1) * 100);
  const roundedDelta = Math.round(delta);

  let message: string;
  if (logs.length === 0) message = "Log a workout to see how this week adapts.";
  else if (factor < 1) message = `You're ${roundedDelta} load ahead of plan. The rest of this week is ${pct}% lighter so you absorb it.`;
  else if (factor > 1) message = `You're ${-roundedDelta} load behind plan. The rest of this week is up ${pct}% (capped at ${MAX_ADD * 100}% — missed work isn't crammed in).`;
  else if (roundedDelta === 0 || remainingPlanned === 0) message = remainingPlanned === 0 ? "Week complete. Nice work." : "Right on plan.";
  else message = "On track.";
  if (factor === 1 - MAX_CUT && delta > remainingPlanned * MAX_CUT) {
    message += " That's a big overshoot; take an extra easy day if you feel flat.";
  }

  const warnings: string[] = [];
  for (const st of states) {
    if (st.log?.rpe && st.log.rpe >= 8 && st.session.intensity && EASY.test(st.session.intensity)) {
      warnings.push(`${st.session.day}'s ${st.session.name} was meant to be easy but felt ${st.log.rpe}/10. If that keeps happening, you may need more recovery.`);
    }
  }

  return { states, extras, days, plannedTotal, doneTotal, delta: roundedDelta, factor, message, warnings };
}

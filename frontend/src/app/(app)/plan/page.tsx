"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { mockWeeklyPlan } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Bike, Footprints, Waves, Coffee, Dumbbell, CheckCircle2, NotebookPen } from "lucide-react";
import { LoadChart } from "@/components/plan/LoadChart";
import { WorkoutLogPanel } from "@/components/plan/WorkoutLogPanel";
import { listLogs, type WorkoutLog } from "@/lib/trainingApi";
import { adjustWeek, buildWeek, isoDate, type SessionState } from "@/lib/weekPlan";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { useUnits } from "@/components/units/UnitsProvider";
import {
  formatDistance,
  formatFluidPerHour,
  formatShortDistance,
  milesToMeters,
  ozToMl,
  yardsToMeters,
} from "@/lib/units";

const sportIcon: Record<string, React.ElementType> = {
  Run: Footprints, Swim: Waves, Bike: Bike,
};

const sportStyle: Record<string, { border: string; bg: string; dot: string; label: string }> = {
  // Sport colors follow the race-day leg bar: swim blue, bike lime, run off-white.
  Swim: { border: "border-swim/30", bg: "bg-swim/5", dot: "bg-swim", label: "text-swim" },
  Bike: { border: "border-lime/30", bg: "bg-lime/5", dot: "bg-lime", label: "text-lime" },
  Run:  { border: "border-fg/20", bg: "bg-fg/[0.03]", dot: "bg-fg", label: "text-fg" },
};

const intensityBadge: Record<string, string> = {
  "Zone 1":   "bg-[#1e3a5f] text-[#93c5fd] border-[#2563eb]/30",
  "Zone 2":   "bg-[#14532d] text-[#4ade80] border-[#16a34a]/30",
  "Zone 3":   "bg-[#713f12] text-[#fbbf24] border-[#d97706]/30",
  "Zone 3–4": "bg-[#7c2d12] text-[#fb923c] border-[#ea580c]/30",
  "Zone 4":   "bg-[#7f1d1d] text-[#f87171] border-lime/30",
  "Zone 2–3": "bg-[#134e4a] text-[#34d399] border-[#059669]/30",
};

function SessionStatus({ state, onLog }: { state: SessionState | undefined; onLog: () => void }) {
  const { units } = useUnits();
  if (!state) return null;
  const { log, adjusted, notLogged, session } = state;
  const swim = session.sport === "Swim";
  const dist = (m: number) => (swim ? formatShortDistance(m, units) : formatDistance(m, units));
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {log ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4ade80] bg-[#14532d]/40 px-2 py-0.5 rounded">
          <CheckCircle2 className="w-3 h-3" />
          {log.status === "skipped" ? "Skipped" : `Done${log.actual_duration_min ? ` · ${Math.round(log.actual_duration_min)}m` : ""}${log.actual_distance_m ? ` · ${dist(log.actual_distance_m)}` : ""}${log.rpe ? ` · RPE ${log.rpe}` : ""} · load ${log.load}`}
        </span>
      ) : adjusted ? (
        <span className="text-[10px] font-bold text-white bg-surface2 border border-dashed border-[#e5484d]/60 px-2 py-0.5 rounded">
          Adjusted: {adjusted.duration_min}m{adjusted.distance_m ? ` · ${dist(adjusted.distance_m)}` : ""} · load {adjusted.load}
        </span>
      ) : notLogged ? (
        <span className="text-[10px] text-muted">Not logged</span>
      ) : null}
      {log?.notes && <span className="text-[10px] text-muted italic truncate max-w-[260px]">“{log.notes}”</span>}
      {(log || notLogged || state.session.date <= isoDate(new Date())) && (
        <button onClick={onLog} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#60a5fa] hover:underline">
          <NotebookPen className="w-3 h-3" /> {log ? "Edit log" : "Log it"}
        </button>
      )}
    </div>
  );
}

export default function PlanPage() {
  const { units } = useUnits();
  const { getToken, isSignedIn } = useAuth();
  const [today] = useState(() => new Date());
  const todayIso = isoDate(today);
  const { dates, sessions } = useMemo(() => buildWeek(today), [today]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logError, setLogError] = useState(false);
  const [selectedKey, setSelectedKey] = useState(
    () => [...sessions].reverse().find((s) => s.date <= todayIso)?.key ?? "extra",
  );

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await listLogs(await getToken(), dates[0], dates[6]);
        if (!cancelled) setLogs(result);
      } catch {
        if (!cancelled) setLogError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, dates]);

  const week = useMemo(() => adjustWeek(dates, sessions, logs, todayIso), [dates, sessions, logs, todayIso]);
  const stateFor = (key: string) => week.states.find((st) => st.session.key === key);

  function onLogChanged(log: WorkoutLog | null, removedId?: string) {
    setLogs((prev) => {
      const rest = prev.filter((l) => l.id !== removedId && (!log || `${l.date}:${l.slot}` !== `${log.date}:${log.slot}`));
      return log ? [...rest, log] : rest;
    });
  }

  function openLog(key: string) {
    setSelectedKey(key);
    document.getElementById("workout-log")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const weekTSS   = mockWeeklyPlan.reduce((s, d) => s + (d.workout?.tss ?? 0) + (d.strength?.tss ?? 0), 0);
  const weekHours = mockWeeklyPlan.reduce((s, d) => s + (d.workout?.duration_min ?? 0) + (d.strength?.duration_min ?? 0), 0) / 60;

  return (
    <div className="px-5 py-7 lg:px-10 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-muted mb-1.5">Weekly Schedule</p>
          <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px]">Training Plan</h1>
          <p className="text-sm text-muted mt-0.5">
            Example week · {new Date(dates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}–{new Date(dates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-5">
          <div className="text-right">
            <div className="text-2xl font-semibold text-white">{weekTSS}</div>
            <div className="text-[9px] text-muted font-bold uppercase tracking-widest">TSS</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-white">{weekHours.toFixed(1)}h</div>
            <div className="text-[9px] text-muted font-bold uppercase tracking-widest">Volume</div>
          </div>
        </div>
      </div>

      <DemoBanner
        className="mb-6"
        message="Example schedule. Weekly plan generation isn't built yet, but your logged workouts are real and shift the rest of this week."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="min-w-0">
      {/* Phase banner */}
      <div className="rounded-[24px] border border-lime/20 bg-lime/5 p-4 mb-6 flex items-center gap-4">
        <div className="w-1 h-12 bg-lime rounded-full flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-white mb-0.5">Base Phase — Swim-Heavy + Strength Foundation</div>
          <p className="text-xs text-muted leading-relaxed">
            3 swims · 2 bikes · 1 run · 2 strength doubles. Mon and Sun are double days — swim first, strength after a short rest.
            Saturday long ride is the key endurance session.
          </p>
        </div>
      </div>

      {/* Calendar */}
      <div className="space-y-2">
        {mockWeeklyPlan.map((day) => {
          if (day.rest || !day.workout) {
            return (
              <div key={day.day} className="rounded-[24px] border border-stroke bg-surface p-4 flex items-center gap-4">
                <div className="w-14 text-center flex-shrink-0">
                  <div className="text-sm font-semibold text-muted/70">{day.day}</div>
                  <div className="text-[9px] text-muted/70">{new Date(dates[mockWeeklyPlan.indexOf(day)] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                </div>
                <Coffee className="w-4 h-4 text-muted/70" />
                <div>
                  <div className="text-sm font-bold text-muted/70">Rest Day</div>
                  <div className="text-[11px] text-muted/70">Walk, mobility, or full rest. Recovery is training.</div>
                </div>
              </div>
            );
          }

          const w   = day.workout;
          const str = "strength" in day ? day.strength : undefined;
          const Icon = sportIcon[w.sport] ?? Footprints;
          const ss   = sportStyle[w.sport] ?? sportStyle.Run;
          const ib   = intensityBadge[w.intensity ?? "Zone 2"] ?? "";

          return (
            <div key={day.day} className="space-y-1.5">
              {/* Primary workout */}
              <div className={cn("rounded-[24px] border p-4 transition-all", ss.border, ss.bg)}>
                <div className="flex items-start gap-4">
                  {/* Day */}
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className="text-sm font-semibold text-white">{day.day}</div>
                    <div className="text-[9px] text-muted">{new Date(dates[mockWeeklyPlan.indexOf(day)] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    {str && (
                      <div className="text-[8px] font-semibold text-lime uppercase tracking-wider mt-1">AM</div>
                    )}
                  </div>

                  {/* Sport dot + icon */}
                  <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                    <div className={cn("w-2 h-2 rounded-full", ss.dot)} />
                    <Icon className={cn("w-4 h-4", ss.label)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-white">{w.name}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", ib)}>
                        {w.intensity}
                      </span>
                      <span className="text-[9px] text-muted/70 font-bold bg-surface2 px-2 py-0.5 rounded">TSS {w.tss}</span>
                    </div>
                    <p className="text-[12px] text-muted leading-relaxed">{w.notes}</p>
                    <SessionStatus state={stateFor(`${dates[mockWeeklyPlan.indexOf(day)]}:main`)} onLog={() => openLog(`${dates[mockWeeklyPlan.indexOf(day)]}:main`)} />

                    {"fueling" in w && w.fueling && (
                      <div className="flex gap-4 text-[9px] text-muted bg-surface2 rounded-lg px-3 py-2 mt-2 font-medium">
                        <span>🍬 {w.fueling.carbs_per_hour}g/hr GF carbs</span>
                        <span>💧 {formatFluidPerHour(ozToMl(w.fueling.water_oz_per_hour), units)}</span>
                        <span>🧂 {w.fueling.sodium_mg_per_hour}mg Na/hr</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 flex-shrink-0 text-right">
                    <div>
                      <div className="text-sm font-semibold text-white">{w.duration_min}m</div>
                      <div className="text-[9px] text-muted/70 font-bold uppercase">Time</div>
                    </div>
                    {"distance_yards" in w && w.distance_yards && (
                      <div>
                        <div className="text-sm font-semibold text-white">{formatShortDistance(yardsToMeters(w.distance_yards), units)}</div>
                        <div className="text-[9px] text-muted/70 font-bold uppercase">Dist</div>
                      </div>
                    )}
                    {"distance_mi" in w && w.distance_mi && (
                      <div>
                        <div className="text-sm font-semibold text-white">{formatDistance(milesToMeters(w.distance_mi), units)}</div>
                        <div className="text-[9px] text-muted/70 font-bold uppercase">Dist</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Strength session (double day) */}
              {str && (
                <div className="rounded-[24px] border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4 ml-4">
                  <div className="flex items-start gap-4">
                    {/* PM label */}
                    <div className="w-10 flex-shrink-0 text-center pt-0.5">
                      <div className="text-[8px] font-semibold text-[#a78bfa] uppercase tracking-wider">PM</div>
                    </div>

                    {/* Icon */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
                      <Dumbbell className="w-4 h-4 text-[#a78bfa]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-white">{str.name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[#4a1d96] text-[#c4b5fd] border-[#7c3aed]/30">
                          {str.focus === "lower" ? "Lower Body" : "Full Body"}
                        </span>
                        <span className="text-[9px] text-muted/70 font-bold bg-surface2 px-2 py-0.5 rounded">TSS {str.tss}</span>
                      </div>
                      <p className="text-[12px] text-muted leading-relaxed">{str.notes}</p>
                      <SessionStatus state={stateFor(`${dates[mockWeeklyPlan.indexOf(day)]}:strength`)} onLog={() => openLog(`${dates[mockWeeklyPlan.indexOf(day)]}:strength`)} />
                    </div>

                    {/* Duration */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-white">{str.duration_min}m</div>
                      <div className="text-[9px] text-muted/70 font-bold uppercase">Time</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Week summary */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          { label: "🏊 Swim",     time: "2h 10m", vol: "4,100yd · 3×",  color: "text-[#60a5fa]" },
          { label: "🚴 Bike",     time: "2h 30m", vol: "39.8mi · 2×",   color: "text-[#fbbf24]" },
          { label: "🏃 Run",      time: "40m",    vol: "3.4mi · 1×",    color: "text-[#f87171]" },
          { label: "💪 Strength", time: "1h 10m", vol: "2 doubles",      color: "text-[#a78bfa]" },
        ].map((s) => (
          <div key={s.label} className="rounded-[24px] border border-stroke bg-surface p-3 text-center">
            <div className={cn("text-xs font-bold", s.color)}>{s.label}</div>
            <div className="text-lg font-semibold text-white mt-1">{s.time}</div>
            <div className="text-[9px] text-muted">{s.vol}</div>
          </div>
        ))}
      </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <LoadChart week={week} todayIso={todayIso} />
        <div id="workout-log" className="scroll-mt-6">
          {isSignedIn ? (
            <WorkoutLogPanel sessions={sessions} logs={logs} selectedKey={selectedKey} onSelect={setSelectedKey}
              onChanged={onLogChanged} todayIso={todayIso} />
          ) : (
            <p className="text-xs text-muted">Sign in to log workouts.</p>
          )}
          {logError && <p className="text-[11px] text-[#f87171] mt-2">Couldn&apos;t load your logs. Refresh to try again.</p>}
        </div>
      </aside>
      </div>
    </div>
  );
}

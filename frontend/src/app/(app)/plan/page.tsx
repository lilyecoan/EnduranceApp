"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Bike, CheckCircle2, ChevronLeft, ChevronRight, Coffee, Dumbbell, Flag, Footprints, Loader2, NotebookPen, RefreshCw, Shuffle, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadChart } from "@/components/plan/LoadChart";
import { WorkoutLogPanel } from "@/components/plan/WorkoutLogPanel";
import { useUnits } from "@/components/units/UnitsProvider";
import {
  fetchWeekPlan, listActivities, listLogs, regenerateWeekPlan,
  type PlanSession, type SyncedActivity, type WeekPlan, type WorkoutLog,
} from "@/lib/trainingApi";
import {
  adjustWeek, dayLabel, isoDate, sessionsFromPlan, syncedAsLogs, weekDates, weekStart, type SessionState,
} from "@/lib/weekPlan";
import { formatDistance, formatShortDistance, renderUnitTokens } from "@/lib/units";

const sportIcon: Record<string, React.ElementType> = {
  Run: Footprints, Swim: Waves, Bike: Bike, Strength: Dumbbell, Cross: Shuffle, Race: Flag,
};

// Sport colors follow the race-day leg bar: swim blue, bike lime, run off-white.
const sportStyle: Record<string, { border: string; bg: string; label: string }> = {
  Swim: { border: "border-swim/30", bg: "bg-swim/5", label: "text-swim" },
  Bike: { border: "border-lime/30", bg: "bg-lime/5", label: "text-lime" },
  Run: { border: "border-fg/20", bg: "bg-fg/[0.03]", label: "text-fg" },
  Strength: { border: "border-[#a78bfa]/25", bg: "bg-[#a78bfa]/5", label: "text-[#a78bfa]" },
  Cross: { border: "border-stroke", bg: "bg-surface", label: "text-muted" },
  Race: { border: "border-lime", bg: "bg-lime/10", label: "text-lime" },
};

const SOURCE_NAME: Record<string, string> = {
  intervals_icu: "Intervals.icu", health_auto_export: "Apple Health", file_upload: "upload", strava: "Strava",
};

function shortDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function SessionStatus({ state, onLog, todayIso }: { state: SessionState | undefined; onLog: () => void; todayIso: string }) {
  const { units } = useUnits();
  if (!state) return null;
  const { log, adjusted, notLogged, session } = state;
  const dist = (m: number) => (session.sport === "Swim" ? formatShortDistance(m, units) : formatDistance(m, units));
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {log ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4ade80] bg-[#14532d]/40 px-2.5 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          {log.status === "skipped"
            ? "Skipped"
            : `${log.synced ? `Synced from ${SOURCE_NAME[log.synced.source] ?? log.synced.source}` : "Done"}${log.actual_duration_min ? ` · ${Math.round(log.actual_duration_min)}m` : ""}${log.actual_distance_m ? ` · ${dist(log.actual_distance_m)}` : ""}${log.rpe ? ` · RPE ${log.rpe}` : ""} · load ${Math.round(log.load)}`}
        </span>
      ) : adjusted ? (
        <span className="text-[11px] font-semibold text-fg bg-surface2 border border-dashed border-[#e5484d]/60 px-2.5 py-1 rounded-full">
          Adjusted: {adjusted.duration_min}m{adjusted.distance_m ? ` · ${dist(adjusted.distance_m)}` : ""} · load {adjusted.load}
        </span>
      ) : notLogged ? (
        <span className="text-[11px] text-muted">Not logged</span>
      ) : null}
      {log?.notes && <span className="text-[11px] text-muted italic truncate max-w-[260px]">“{log.notes}”</span>}
      {session.date <= todayIso && (
        <button onClick={onLog} className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime hover:underline">
          <NotebookPen className="w-3 h-3" /> {log && !log.synced ? "Edit log" : log?.synced ? "Add notes" : "Log it"}
        </button>
      )}
    </div>
  );
}

function SessionCard({ s, state, onLog, todayIso }: { s: PlanSession; state?: SessionState; onLog: () => void; todayIso: string }) {
  const { units } = useUnits();
  const Icon = sportIcon[s.sport] ?? Footprints;
  const st = sportStyle[s.sport] ?? sportStyle.Cross;
  return (
    <div className={cn("rounded-[24px] border p-4 lg:p-5", st.border, st.bg, s.slot === "strength" && "lg:ml-10")}>
      <div className="flex items-start gap-3">
        <span className={cn("size-9 rounded-full bg-surface2 flex items-center justify-center shrink-0", st.label)}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-fg">{s.name}</span>
            {s.intensity && s.sport !== "Race" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface2 text-muted">{s.intensity}</span>
            )}
            {s.slot === "strength" && <span className="text-[10px] font-semibold text-muted">Second session</span>}
          </div>
          <p className="text-[13px] text-muted leading-relaxed mt-1">{renderUnitTokens(s.description, units)}</p>
          {s.sport === "Race" ? (
            <Link href="/race" className="inline-block mt-2 text-[12px] font-semibold text-lime">Open race-day plan →</Link>
          ) : (
            <SessionStatus state={state} onLog={onLog} todayIso={todayIso} />
          )}
        </div>
        {s.sport !== "Race" && (
          <div className="flex gap-4 shrink-0 text-right">
            <div>
              <div className="text-sm font-semibold text-fg">{s.duration_min}m</div>
              <div className="text-[9px] text-muted font-semibold uppercase">Time</div>
            </div>
            {s.distance_m && (
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-fg">
                  {s.sport === "Swim" ? formatShortDistance(s.distance_m, units) : formatDistance(s.distance_m, units)}
                </div>
                <div className="text-[9px] text-muted font-semibold uppercase">≈ Dist</div>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-fg">{s.load}</div>
              <div className="text-[9px] text-muted font-semibold uppercase">Load</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncedList({ activities }: { activities: SyncedActivity[] }) {
  const { units } = useUnits();
  const kind: Record<string, string> = { swimming: "Swim", cycling: "Bike", running: "Run", strength: "Strength" };
  return (
    <div className="rounded-[24px] border border-stroke bg-surface p-4">
      <p className="text-sm font-semibold text-fg mb-1">Synced this week</p>
      {activities.length === 0 ? (
        <p className="text-xs text-muted">
          No workouts synced yet this week. Connect a source in <Link href="/settings" className="text-lime">Settings</Link>, or log sessions below.
        </p>
      ) : (
        <ul className="divide-y divide-stroke">
          {activities.map((a) => {
            const sport = kind[a.sport] ?? "Cross";
            const Icon = sportIcon[sport] ?? Shuffle;
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <Icon className={cn("w-4 h-4 shrink-0", (sportStyle[sport] ?? sportStyle.Cross).label)} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-fg truncate">{a.name || sport}</p>
                  <p className="text-[11px] text-muted">
                    {dayLabel(isoDate(new Date(a.start_time)))} · {a.duration_min ? `${Math.round(a.duration_min)}m` : "–"}
                    {a.distance_m ? ` · ${sport === "Swim" ? formatShortDistance(a.distance_m, units) : formatDistance(a.distance_m, units)}` : ""}
                    {a.avg_hr ? ` · ${a.avg_hr} bpm` : ""}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-fg" title={a.load_from_source ? "Load from source" : "Estimated from duration"}>
                  {Math.round(a.load)}{a.load_from_source ? "" : "*"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {activities.some((a) => !a.load_from_source) && <p className="text-[10px] text-muted mt-1">* load estimated from duration</p>}
    </div>
  );
}

export default function PlanPage() {
  const { getToken, isSignedIn } = useAuth();
  const [todayIso] = useState(() => isoDate(new Date()));
  const thisMonday = useMemo(() => isoDate(weekStart(new Date())), []);
  const [monday, setMonday] = useState(thisMonday);
  const dates = useMemo(() => weekDates(monday), [monday]);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [activities, setActivities] = useState<SyncedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [selectedKey, setSelectedKey] = useState("extra");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [p, l, a] = await Promise.all([
        fetchWeekPlan(token, monday),
        listLogs(token, dates[0], dates[6]),
        listActivities(token, dates[0], dates[6]),
      ]);
      setPlan(p);
      setLogs(l);
      setActivities(a);
      const past = p.sessions.filter((s) => s.sport !== "Race" && s.date <= todayIso);
      setSelectedKey(past.length ? `${past[past.length - 1].date}:${past[past.length - 1].slot}` : "extra");
    } catch {
      setError("Couldn't load your plan. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [getToken, monday, dates, todayIso]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, load]);

  async function rebuild() {
    setRebuilding(true);
    try {
      setPlan(await regenerateWeekPlan(await getToken(), monday));
    } catch {
      setError("Couldn't rebuild the week. Try again.");
    } finally {
      setRebuilding(false);
    }
  }

  const sessions = useMemo(() => (plan ? sessionsFromPlan(plan) : []), [plan]);
  const allLogs = useMemo(() => [...logs, ...syncedAsLogs(activities, sessions, logs)], [logs, activities, sessions]);
  const week = useMemo(() => adjustWeek(dates, sessions, allLogs, todayIso), [dates, sessions, allLogs, todayIso]);
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

  const canGoBack = monday > addDays(thisMonday, -28);
  const canGoForward = monday < addDays(thisMonday, 14);
  const weekTitle = monday === thisMonday ? "This week" : monday > thisMonday ? "Upcoming week" : "Past week";

  return (
    <div className="px-5 py-7 lg:px-10 lg:py-8 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-muted mb-1.5">Training Plan</p>
          <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px]">
            {plan ? `${plan.phase_label}${plan.recovery_week ? " · recovery week" : ""}` : "Your week"}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {weekTitle} · {shortDate(dates[0])}–{shortDate(dates[6])}
            {plan?.weeks_to_race != null && ` · ${plan.weeks_to_race} weeks to race`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {plan && (
            <div className="flex gap-5">
              <div className="text-right">
                <div className="text-2xl font-semibold text-fg">{plan.planned_load}</div>
                <div className="text-[9px] text-muted font-semibold uppercase tracking-widest">Load</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-fg">{plan.planned_hours}h</div>
                <div className="text-[9px] text-muted font-semibold uppercase tracking-widest">Volume</div>
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <button aria-label="Previous week" disabled={!canGoBack || loading} onClick={() => setMonday(addDays(monday, -7))}
              className="size-10 rounded-full bg-surface border border-stroke flex items-center justify-center text-fg disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </button>
            <button aria-label="Next week" disabled={!canGoForward || loading} onClick={() => setMonday(addDays(monday, 7))}
              className="size-10 rounded-full bg-surface border border-stroke flex items-center justify-center text-fg disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}
      {plan?.stale && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-lime/40 bg-lime/5 rounded-[18px] px-4 py-3 mb-5">
          <p className="text-[13px] text-fg">Your goal, race, zones or health notes changed since this week was built.</p>
          <button onClick={rebuild} disabled={rebuilding} className="bg-lime text-ink rounded-full px-4 py-2 text-[13px] font-semibold">
            Rebuild week
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="min-w-0 flex flex-col gap-5">
          {loading ? (
            <p className="text-sm text-muted flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Building your week…</p>
          ) : plan && (
            <>
              <div className="rounded-[24px] bg-surface2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-fg">Why this week looks like this</p>
                  <button onClick={rebuild} disabled={rebuilding}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-fg shrink-0">
                    <RefreshCw className={cn("size-3.5", rebuilding && "animate-spin")} /> Rebuild
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {[...plan.reasons, ...plan.notes].map((r, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-muted"><span className="text-lime">•</span>{r}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted/70 mt-3">
                  Built from your race date, recent workouts, recovery data and health notes. Not medical advice.
                </p>
              </div>

              {dates.map((date) => {
                const daySessions = plan.sessions.filter((s) => s.date === date);
                return (
                  <section key={date} className="flex flex-col gap-2">
                    <p className={cn("text-[12px] font-semibold uppercase tracking-wider", date === todayIso ? "text-lime" : "text-muted")}>
                      {dayLabel(date)} · {shortDate(date)}{date === todayIso ? " · Today" : ""}
                    </p>
                    {daySessions.length === 0 ? (
                      <div className="rounded-[24px] border border-stroke bg-surface p-4 flex items-center gap-3">
                        <Coffee className="w-4 h-4 text-muted" />
                        <span className="text-[13px] text-muted">Rest day. Walk, mobility, or full rest; recovery is training.</span>
                      </div>
                    ) : (
                      daySessions.map((s) => (
                        <SessionCard key={s.id} s={s} state={stateFor(`${s.date}:${s.slot}`)} todayIso={todayIso}
                          onLog={() => openLog(`${s.date}:${s.slot}`)} />
                      ))
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <LoadChart week={week} todayIso={todayIso} />
          <SyncedList activities={activities} />
          <div id="workout-log" className="scroll-mt-6">
            {isSignedIn && plan && (
              <WorkoutLogPanel sessions={sessions} logs={logs} selectedKey={selectedKey} onSelect={setSelectedKey}
                onChanged={onLogChanged} todayIso={todayIso} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

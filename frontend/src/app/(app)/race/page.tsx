"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Bike, ExternalLink, Footprints, Loader2, Pencil, RefreshCw, Utensils, Waves } from "lucide-react";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { daysUntil, weeksUntil } from "@/lib/utils";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { RaceSetupForm } from "@/components/race/RaceSetupForm";
import { NutritionPlanView } from "@/components/race/NutritionPlanView";
import { useUnits } from "@/components/units/UnitsProvider";
import { fetchRace, generateNutritionPlan, type Race } from "@/lib/raceApi";
import { goalLabel } from "@/lib/raceTypes";
import { formatClock, formatDistance, formatRunPace, formatShortDistance, formatSwimPace } from "@/lib/units";

const card = "rounded-xl border border-[#1e1e1e] bg-[#111] p-5";

export default function RacePage() {
  const { getToken, isSignedIn } = useAuth();
  const { profile } = useAthleteProfile();
  const { plan, loading: planLoading } = useCoachingPlan();
  const { units } = useUnits();
  const [race, setRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRace(await getToken());
        if (!cancelled) setRace(r);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  async function buildPlan() {
    setBuilding(true);
    setBuildError(null);
    try {
      setRace(await generateNutritionPlan(await getToken()));
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Couldn't build the plan. Try again.");
    } finally {
      setBuilding(false);
    }
  }

  function onSaved(saved: Race) {
    setRace(saved);
    setEditing(false);
  }

  const days = race ? daysUntil(race.race_date) : null;
  const weeks = race ? weeksUntil(race.race_date) : null;
  const strategy = plan?.race_strategy;
  const noRaceGoal = profile?.training_goal === "gym" || profile?.training_goal === "general";

  if (loading) {
    return <div className="p-6 text-sm text-[#525252]">{loadError ? "Couldn't load your race." : "Loading race…"}</div>;
  }

  if (!race || editing) {
    return (
      <div className="p-6 max-w-2xl">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Race Day</p>
        <h1 className="text-2xl font-black text-white tracking-tight mb-1">{race ? "Edit your race" : "Add your race"}</h1>
        <p className="text-sm text-[#737373] mb-5">
          {noRaceGoal && !race
            ? `You're training for ${goalLabel(profile?.training_goal).toLowerCase()}, so there's no race to plan for. Add one here if you sign up for an event.`
            : "Paste the race's official page and we'll fill in what we can. Then we'll build a race-day nutrition plan around its start time, weather, altitude and your health notes."}
        </p>
        <div className={card}>
          <RaceSetupForm race={race} goal={noRaceGoal ? undefined : profile?.training_goal ?? undefined}
            onSaved={onSaved} onCancel={race ? () => setEditing(false) : undefined} />
        </div>
      </div>
    );
  }

  const nutrition = race.nutrition_plan;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Race Day · {goalLabel(race.race_type)}</p>
          <h1 className="text-2xl font-black text-white tracking-tight">{race.name}</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            {new Date(race.race_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            {race.start_time && ` · starts ${formatClock(race.start_time.slice(0, 5))}`}
            {race.location && ` · ${race.location}`}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#737373]">
            {race.swim_distance_m != null && <span className="inline-flex items-center gap-1"><Waves className="w-3 h-3" />{formatShortDistance(race.swim_distance_m, units)}</span>}
            {race.bike_distance_km != null && <span className="inline-flex items-center gap-1"><Bike className="w-3 h-3" />{formatDistance(race.bike_distance_km * 1000, units)}</span>}
            {race.run_distance_km != null && <span className="inline-flex items-center gap-1"><Footprints className="w-3 h-3" />{formatDistance(race.run_distance_km * 1000, units)}</span>}
            {race.race_url && (
              <a href={race.race_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#60a5fa] hover:underline">
                Race page <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 font-bold text-[#a3a3a3] hover:text-white">
              <Pencil className="w-3 h-3" /> Edit race
            </button>
          </div>
        </div>
        {days !== null && weeks !== null && days >= 0 && (
          <div className="text-right rounded-xl border border-[#CE0E2D]/20 bg-[#CE0E2D]/5 px-5 py-3 flex-shrink-0">
            <div className="text-3xl font-black text-white tabular-nums">{days}</div>
            <div className="text-[9px] text-[#CE0E2D] font-bold uppercase tracking-widest">days · {weeks} weeks</div>
          </div>
        )}
      </div>

      {/* Race-day nutrition */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black text-white inline-flex items-center gap-2"><Utensils className="w-4 h-4 text-[#fbbf24]" /> Race-day nutrition plan</h2>
        {nutrition && (
          <button onClick={buildPlan} disabled={building}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#262626] text-[#a3a3a3] hover:text-white disabled:opacity-40">
            {building ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Rebuild
          </button>
        )}
      </div>
      {buildError && <p className="text-xs text-[#f87171] mb-3">{buildError}</p>}
      {race.nutrition_plan_stale && (
        <div className="rounded-lg border border-[#d97706]/30 bg-[#d97706]/10 px-4 py-2 mb-3 text-xs text-[#fbbf24]">
          Your race details changed since this plan was made. Rebuild it to match.
        </div>
      )}
      {nutrition ? (
        <NutritionPlanView race={race} plan={nutrition} />
      ) : (
        <div className={`${card} text-center`}>
          <p className="text-sm text-[#a3a3a3] mb-1">A fueling plan just for this race.</p>
          <p className="text-xs text-[#525252] mb-4">
            Timed to your start, adjusted for race-day weather, altitude and course, and checked against your health and dietary notes.
          </p>
          <button onClick={buildPlan} disabled={building}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[#CE0E2D] text-white hover:bg-[#b00c27] disabled:opacity-40">
            {building ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Utensils className="w-3.5 h-3.5" />}
            {building ? "Building… (checking weather)" : "Build my race-day plan"}
          </button>
        </div>
      )}

      {/* Pacing from the coaching agents (within 8 weeks of race day) */}
      <h2 className="text-sm font-black text-white mt-8 mb-3">Pacing</h2>
      {planLoading ? (
        <p className="text-sm text-[#525252]">Loading race strategy…</p>
      ) : !strategy ? (
        <div className={`${card} text-sm text-[#525252]`}>
          Pacing targets activate within 8 weeks of your race. Focus on base training until then.
        </div>
      ) : (
        <>
          <CoachCard
            title="Race Strategy"
            message={plan?.today_recommendation || "No new plan generated today."}
            type="info"
            metrics={[
              ...(strategy.bike_watts_target ? [{ label: "Bike Target", value: `${strategy.bike_watts_target}W` }] : []),
              ...(strategy.run_pace_target ? [{ label: "Run Target", value: formatRunPace(strategy.run_pace_target, units) }] : []),
              ...(strategy.swim_pace_per_100m ? [{ label: "Swim Target", value: formatSwimPace(strategy.swim_pace_per_100m, units) }] : []),
            ]}
            agentSource="Race Strategy Agent"
            className="mb-4"
          />
          {strategy.taper_notes && <div className={`${card} mb-4 text-sm text-[#737373]`}>{strategy.taper_notes}</div>}
          {strategy.key_race_notes.length > 0 && (
            <div className={card}>
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Key Race Notes</p>
              <ul className="space-y-1.5 text-sm text-[#737373] list-disc list-inside">
                {strategy.key_race_notes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

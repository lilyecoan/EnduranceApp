"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { daysUntil } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { RaceSetupForm } from "@/components/race/RaceSetupForm";
import { SlideButton } from "@/components/race/SlideButton";
import {
  Conditions, Countdown, Fueling, PacingLocked, RaceActions, RaceHero, RaceTimeline, Sources,
} from "@/components/race/RaceSections";
import { StatTile } from "@/components/ui/StatTile";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { useUnits } from "@/components/units/UnitsProvider";
import { fetchRace, generateNutritionPlan, type Race } from "@/lib/raceApi";
import { goalLabel } from "@/lib/raceTypes";
import { formatRunPace, formatSwimPace } from "@/lib/units";

export default function RacePage() {
  const { getToken, isSignedIn } = useAuth();
  const { profile } = useAthleteProfile();
  const { plan: coaching } = useCoachingPlan();
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

  const days = race ? daysUntil(race.race_date) : null;
  const noRaceGoal = profile?.training_goal === "gym" || profile?.training_goal === "general";
  const strategy = coaching?.race_strategy;
  const nutrition = race?.nutrition_plan;

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-7 lg:gap-9 px-5 lg:px-10 pt-7 lg:pt-8 pb-8 lg:pb-14 max-w-[1440px]">
      <TopBar label="Race Strategy" title="Your race, planned to the minute." />
      <div className="lg:hidden flex flex-col gap-1.5">
        <h1 className="text-[40px] leading-none font-semibold text-fg tracking-[-1.6px]">Race<br />Strategy</h1>
        <p className="text-sm text-muted">
          {days !== null && days >= 0 ? `${days} days until race day` : "Plan your race day"}
        </p>
      </div>
      {children}
    </div>
  );

  if (loading) {
    return shell(<p className="text-sm text-muted">{loadError ? "Couldn't load your race." : "Loading race…"}</p>);
  }

  if (!race || editing) {
    return shell(
      <div className="max-w-2xl flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-fg tracking-[-0.48px]">{race ? "Edit your race" : "Add your race"}</h2>
          <p className="text-sm text-muted mt-1.5">
            {noRaceGoal && !race
              ? `You're training for ${goalLabel(profile?.training_goal).toLowerCase()}, so there's no race to plan for. Add one if you sign up for an event.`
              : "Paste the race's official page and we'll fill in what we can, then build a race-day plan around its start time, weather, altitude and your health notes."}
          </p>
        </div>
        <div className="bg-surface border border-stroke rounded-[28px] p-5 lg:p-7">
          <RaceSetupForm race={race} goal={noRaceGoal ? undefined : profile?.training_goal ?? undefined}
            onSaved={(saved) => { setRace(saved); setEditing(false); }} onCancel={race ? () => setEditing(false) : undefined} />
        </div>
      </div>,
    );
  }

  return shell(
    <>
      <div className="flex flex-col lg:flex-row gap-7 lg:gap-5 w-full">
        <RaceHero race={race} onEdit={() => setEditing(true)} />
        {days !== null && days >= 0 && (
          <div className="flex flex-col gap-5 lg:w-[340px] lg:shrink-0">
            <Countdown days={days} />
            <RaceActions race={race} onEdit={() => setEditing(true)} />
          </div>
        )}
      </div>
      {nutrition && <SlideButton className="lg:hidden -mt-2" />}
      <button onClick={() => setEditing(true)} className="lg:hidden -mt-3 self-start text-[13px] font-semibold text-lime">
        Edit race details →
      </button>

      {buildError && <p className="text-sm text-[#f87171]">{buildError}</p>}
      {race.nutrition_plan_stale && (
        <div className="flex items-center justify-between gap-3 border border-lime/40 bg-lime/5 rounded-[18px] px-4 py-3">
          <p className="text-[13px] text-fg">Your race details changed since this plan was made.</p>
          <button onClick={buildPlan} disabled={building} className="bg-lime text-ink rounded-full px-4 py-2 text-[13px] font-semibold shrink-0">
            Rebuild
          </button>
        </div>
      )}

      {nutrition ? (
        <>
          <Conditions race={race} plan={nutrition} />
          <Fueling plan={nutrition} onRebuild={buildPlan} building={building} />
          <RaceTimeline plan={nutrition} />
        </>
      ) : (
        <div className="bg-surface border border-stroke rounded-[28px] p-6 lg:p-8 flex flex-col lg:flex-row gap-5 lg:items-center">
          <span className="bg-lime rounded-full size-12 flex items-center justify-center shrink-0">
            <FigmaIcon name="icon-sparkle-ink.svg" size={20} original />
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-fg">Build your race-day plan</h2>
            <p className="text-sm text-muted mt-1">
              Fueling timed to your start, adjusted for race-day weather, altitude and course, and checked against your health and dietary notes.
            </p>
          </div>
          <button onClick={buildPlan} disabled={building}
            className="bg-lime text-ink rounded-full px-5 py-3 text-sm font-semibold flex items-center gap-2 justify-center disabled:opacity-60">
            {building && <Loader2 className="size-4 animate-spin" />}
            {building ? "Checking weather…" : "Build my plan"}
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 w-full items-stretch">
        {strategy ? (
          <div className="flex-1 min-w-0 flex flex-col gap-3.5">
            <h2 className="text-xl lg:text-2xl font-semibold text-fg tracking-[-0.02em]">Pacing targets</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {strategy.swim_pace_per_100m && <StatTile label="Swim" value={formatSwimPace(strategy.swim_pace_per_100m, units).split("/")[0]} unit={`/${formatSwimPace(strategy.swim_pace_per_100m, units).split("/")[1]}`} />}
              {strategy.bike_watts_target && <StatTile label="Bike" value={String(strategy.bike_watts_target)} unit="W" accent />}
              {strategy.run_pace_target && <StatTile label="Run" value={formatRunPace(strategy.run_pace_target, units).split("/")[0]} unit={`/${formatRunPace(strategy.run_pace_target, units).split("/")[1]}`} />}
            </div>
            {strategy.taper_notes && <p className="text-[13px] text-muted">{strategy.taper_notes}</p>}
          </div>
        ) : (
          days !== null && days >= 0 && <PacingLocked raceDate={race.race_date} days={days} />
        )}
        {nutrition && <Sources plan={nutrition} />}
      </div>
    </>,
  );
}

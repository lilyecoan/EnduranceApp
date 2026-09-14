"use client";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { daysUntil, weeksUntil } from "@/lib/utils";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { Bike, Footprints, Waves } from "lucide-react";

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RacePage() {
  const { profile } = useAthleteProfile();
  const { plan, loading } = useCoachingPlan();

  const raceName = profile?.primary_race_name;
  const raceDate = profile?.primary_race_date;
  const days = raceDate ? daysUntil(raceDate) : null;
  const weeks = raceDate ? weeksUntil(raceDate) : null;
  const strategy = plan?.race_strategy;

  if (!raceName || !raceDate) {
    return (
      <div className="p-6 max-w-4xl">
        <p className="text-sm text-[#525252]">
          Set a primary race goal in your profile to see race strategy here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Race Day</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Race Strategy</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            {raceName} · {new Date(raceDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {days !== null && weeks !== null && (
          <div className="text-right rounded-xl border border-[#CE0E2D]/20 bg-[#CE0E2D]/5 px-5 py-3">
            <div className="text-3xl font-black text-white tabular-nums">{days}</div>
            <div className="text-[9px] text-[#CE0E2D] font-bold uppercase tracking-widest">{weeks} weeks to race</div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#525252]">Loading race strategy…</p>
      ) : !strategy ? (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 text-sm text-[#525252]">
          Race-specific strategy activates within 8 weeks of your race date. Focus on base training until then.
        </div>
      ) : (
        <>
          <CoachCard
            title="Race Strategy"
            message={plan?.today_recommendation || "No new plan generated today."}
            type="info"
            metrics={[
              ...(strategy.bike_watts_target ? [{ label: "Bike Target", value: `${strategy.bike_watts_target}W` }] : []),
              ...(strategy.run_pace_target ? [{ label: "Run Target", value: `${formatMMSS(strategy.run_pace_target)}/km` }] : []),
              ...(strategy.swim_pace_per_100m ? [{ label: "Swim Target", value: `${formatMMSS(strategy.swim_pace_per_100m)}/100m` }] : []),
            ]}
            agentSource="Race Strategy Agent"
            className="mb-6"
          />

          {/* Target paces */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Waves className="w-3 h-3" /> Swim
              </div>
              <div className="text-lg font-black text-[#60a5fa]">
                {strategy.swim_pace_per_100m ? `${formatMMSS(strategy.swim_pace_per_100m)}/100m` : "No swim pace on file"}
              </div>
            </div>
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Bike className="w-3 h-3" /> Bike
              </div>
              <div className="text-lg font-black text-[#fbbf24]">
                {strategy.bike_watts_target ? `${strategy.bike_watts_target}W` : "No FTP on file"}
              </div>
            </div>
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Footprints className="w-3 h-3" /> Run
              </div>
              <div className="text-lg font-black text-[#f87171]">
                {strategy.run_pace_target ? `${formatMMSS(strategy.run_pace_target)}/km` : "No run pace on file"}
              </div>
            </div>
          </div>

          {strategy.taper_notes && (
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 mb-6 text-sm text-[#737373]">
              {strategy.taper_notes}
            </div>
          )}

          {strategy.key_race_notes.length > 0 && (
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 mb-6">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Key Race Notes</p>
              <ul className="space-y-1.5 text-sm text-[#737373] list-disc list-inside">
                {strategy.key_race_notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Race Day Fueling */}
          {strategy.fueling_plan.length > 0 && (
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-5">Race Day Fueling</p>
              <div className="space-y-0">
                {strategy.fueling_plan.map((item, i) => {
                  const entry = item as { time?: string; item?: string; carbs_g?: number };
                  return (
                    <div key={i} className="flex items-center gap-4 py-2.5 border-b border-[#1e1e1e] last:border-0">
                      <div className="w-28 flex-shrink-0">
                        <span className="text-[10px] font-black text-[#CE0E2D] bg-[#CE0E2D]/10 px-2 py-0.5 rounded font-mono">
                          {entry.time}
                        </span>
                      </div>
                      <div className="flex-1 text-[12px] text-[#737373]">{entry.item}</div>
                      {!!entry.carbs_g && (
                        <div className="text-xs font-black text-[#60a5fa] flex-shrink-0 bg-[#2563eb]/10 px-2 py-0.5 rounded">
                          {entry.carbs_g}g
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";
import { useUser } from "@clerk/nextjs";
import { Heart, Zap, Moon, Battery, Brain, Activity, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { RaceCountdown } from "@/components/dashboard/RaceCountdown";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { useGarminData } from "@/hooks/useGarminData";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { formatDuration } from "@/lib/utils";

export default function OverviewPage() {
  const { user } = useUser();
  const { data: g, source } = useGarminData();
  const { profile } = useAthleteProfile();
  const { plan, loading: planLoading } = useCoachingPlan();

  const hrvAbove =
    g.hrv_rmssd != null && g.hrv_baseline
      ? Math.round(((g.hrv_rmssd - g.hrv_baseline) / g.hrv_baseline) * 100)
      : null;

  const recoveryScore = plan?.recovery?.score ?? null;
  const readinessScore = g.training_readiness_score ?? null;
  const firstName = user?.firstName || "there";

  return (
    <div className="p-6 max-w-7xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">IronMind AI · Dashboard</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Good morning, {firstName} 👋</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            {profile?.primary_race_name
              ? `${profile.primary_race_name}${profile.primary_race_date ? ` · ${profile.primary_race_date}` : ""}`
              : "Complete your profile to set a race goal"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {hrvAbove !== null && (
            <div className="flex items-center gap-2 bg-[#16a34a]/10 border border-[#16a34a]/25 rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
              <span className="text-xs font-bold text-[#4ade80]">
                {hrvAbove >= 20 ? "HIGH" : hrvAbove >= 0 ? "ELEVATED" : "BELOW"} READINESS · HRV {hrvAbove >= 0 ? "+" : ""}
                {hrvAbove}%
              </span>
            </div>
          )}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
              source === "live"
                ? "bg-[#CE0E2D]/10 text-[#CE0E2D] border border-[#CE0E2D]/20"
                : "bg-[#1a1a1a] text-[#404040] border border-[#222]"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${source === "live" ? "bg-[#CE0E2D] animate-pulse" : "bg-[#404040]"}`} />
            {source === "live" ? "Garmin Live" : "Demo Data"}
          </div>
        </div>
      </div>

      {source === "demo" && (
        <DemoBanner className="mb-4" message="Garmin isn't connected yet — showing demo data." />
      )}

      {/* Coach cards — always from the real coaching pipeline, never a static message */}
      {planLoading ? (
        <div className="mb-6 text-sm text-[#525252]">Running today&apos;s assessment…</div>
      ) : plan ? (
        <>
          <CoachCard
            title="Head Coach"
            message={plan.today_recommendation || "No new plan generated today."}
            type={plan.recovery?.is_low_readiness ? "warning" : "success"}
            metrics={[
              ...(g.hrv_rmssd != null
                ? [{ label: "HRV", value: `${g.hrv_rmssd}ms${hrvAbove !== null ? ` (${hrvAbove >= 0 ? "+" : ""}${hrvAbove}%)` : ""}` }]
                : []),
              ...(g.sleep_score != null ? [{ label: "Sleep", value: `${g.sleep_score}/100` }] : []),
              ...(readinessScore != null ? [{ label: "Readiness", value: `${readinessScore}/100` }] : []),
            ]}
            confidence={plan.confidence}
            agentSource="Head Coach"
            className="mb-3"
          />
          {plan.key_messages.length > 0 && (
            <CoachCard
              title="Today's Notes"
              message={plan.key_messages.join(" ")}
              type="info"
              agentSource="Coaching Agents"
              className="mb-6"
            />
          )}
        </>
      ) : (
        <div className="mb-6 text-sm text-[#525252]">Unable to load today&apos;s assessment.</div>
      )}

      {/* Recovery scores row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="col-span-2 lg:col-span-1 rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Today&apos;s Scores</p>
          <div className="flex items-center justify-around">
            {recoveryScore !== null ? (
              <ScoreRing score={recoveryScore} label="Recovery" size={88} />
            ) : (
              <div className="text-center text-[10px] text-[#404040] uppercase tracking-wider">No recovery data</div>
            )}
            {readinessScore !== null ? (
              <ScoreRing score={readinessScore} label="Readiness" size={88} />
            ) : (
              <div className="text-center text-[10px] text-[#404040] uppercase tracking-wider">No readiness data</div>
            )}
          </div>
        </div>
        <StatCard
          label="HRV"
          value={g.hrv_rmssd ?? "—"}
          unit="ms"
          subtext={g.hrv_baseline ? `Baseline ${g.hrv_baseline}ms` : undefined}
          icon={Activity}
          highlight={hrvAbove !== null && hrvAbove >= 0 ? "success" : "default"}
          trend={hrvAbove !== null ? (hrvAbove >= 0 ? "up" : "down") : "stable"}
          trendValue={hrvAbove !== null ? `${hrvAbove >= 0 ? "+" : ""}${hrvAbove}% baseline` : undefined}
        />
        <StatCard
          label="Sleep"
          value={g.sleep_score ?? "—"}
          unit="/100"
          subtext={g.sleep_duration_seconds ? formatDuration(g.sleep_duration_seconds) : undefined}
          icon={Moon}
        />
        <StatCard label="Body Battery" value={g.body_battery_morning ?? "—"} unit="%" icon={Battery} />
      </div>

      {/* Middle row: Load · Race */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Load</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "CTL", value: g.ctl, color: "text-[#60a5fa]", sub: "Fitness" },
              { label: "ATL", value: g.atl, color: "text-[#fb923c]", sub: "Fatigue" },
              { label: "TSB", value: g.tsb, color: (g.tsb ?? 0) >= -5 ? "text-[#4ade80]" : "text-[#fbbf24]", sub: "Form" },
            ].map((m) => (
              <div key={m.label} className="text-center bg-[#151515] rounded-lg py-2.5">
                <div className={`text-lg font-black tabular-nums ${m.color}`}>{m.value ?? "—"}</div>
                <div className="text-[9px] text-[#525252] font-bold uppercase mt-0.5">{m.label}</div>
                <div className="text-[8px] text-[#404040]">{m.sub}</div>
              </div>
            ))}
          </div>
          {plan?.training_load && (
            <div className="text-[10px] text-center py-1.5 rounded-lg bg-[#151515] border border-[#1e1e1e] text-[#525252] font-bold uppercase tracking-wider">
              {plan.training_load.training_phase} Phase · {plan.training_load.load_status}
            </div>
          )}
        </div>

        {profile?.primary_race_date && profile?.primary_race_name ? (
          <RaceCountdown raceDate={profile.primary_race_date} raceName={profile.primary_race_name} />
        ) : (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 flex items-center justify-center text-sm text-[#525252]">
            Set a race goal in your profile to see a countdown.
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="FTP"
          value={g.ftp ?? "—"}
          unit="W"
          subtext={profile?.weight_kg && g.ftp ? `${(g.ftp / profile.weight_kg).toFixed(2)} W/kg` : undefined}
          icon={Zap}
        />
        <StatCard label="VO₂ Max" value={g.vo2_max ?? "—"} unit="ml/kg/min" icon={TrendingUp} />
        <StatCard label="Resting HR" value={g.resting_hr ?? "—"} unit="bpm" icon={Heart} />
        <StatCard label="Stress" value={g.stress_avg ?? "—"} unit="/100" icon={Brain} />
      </div>
    </div>
  );
}

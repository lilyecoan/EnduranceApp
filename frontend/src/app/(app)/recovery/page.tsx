"use client";
import { useGarminData } from "@/hooks/useGarminData";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { HistoryCharts } from "@/components/recovery/HistoryCharts";
import { Moon, Brain, Activity, Clock } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function RecoveryPage() {
  const { data: g, source } = useGarminData();
  const dataSource = (g as { data_source?: string }).data_source;
  const { plan, loading } = useCoachingPlan();
  const recovery = plan?.recovery;
  const isLive = source === "live";
  const sleepHours = g.sleep_duration_seconds ? (g.sleep_duration_seconds / 3600).toFixed(1) : null;

  return (
    <div className="px-5 py-7 lg:px-10 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted mb-1.5">Biometric Analysis</p>
        <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px]">Recovery Analytics</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-muted">{isLive ? `From ${({ intervals_icu: "Intervals.icu", health_auto_export: "Apple Health", file_upload: "your uploads", manual: "your check-ins" } as Record<string, string>)[dataSource ?? ""] ?? "your data"}` : "Demo data"}</p>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${isLive ? "bg-lime/10 text-lime border border-lime/20" : "bg-surface2 text-muted/70 border border-stroke"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-lime animate-pulse" : "bg-muted/50"}`} />
            {isLive ? "Live" : "Demo"}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted mb-6">Loading recovery assessment…</p>
      ) : recovery ? (
        <CoachCard
          title="Recovery Assessment"
          message={recovery.recommendation}
          type={recovery.is_low_readiness ? "warning" : recovery.score === null ? "info" : "success"}
          metrics={[
            ...(g.hrv_rmssd != null ? [{ label: "HRV", value: `${g.hrv_rmssd}ms` }] : []),
            ...(g.sleep_score != null ? [{ label: "Sleep", value: `${g.sleep_score}/100` }] : []),
            ...(g.training_readiness_score != null ? [{ label: "Readiness", value: `${g.training_readiness_score}/100` }] : []),
          ]}
          agentSource="Recovery Agent"
          className="mb-6"
        />
      ) : null}

      {/* Score Rings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { score: recovery?.score ?? null, label: "Overall Recovery" },
          { score: g.training_readiness_score ?? null, label: "Training Readiness" },
          { score: g.sleep_score ?? null, label: "Sleep Quality" },
          { score: g.body_battery_morning ?? null, label: "Body Battery" },
        ].map((r) => (
          <div key={r.label} className="rounded-[24px] border border-stroke bg-surface p-4 flex flex-col items-center justify-center gap-2">
            {r.score !== null ? (
              <ScoreRing score={r.score} label={r.label} size={100} />
            ) : (
              <div className="text-center text-[10px] text-muted/70 uppercase tracking-wider">No {r.label.toLowerCase()} data</div>
            )}
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="HRV RMSSD" value={g.hrv_rmssd ?? "—"} unit="ms" subtext={g.hrv_baseline ? `Baseline ${g.hrv_baseline}ms` : undefined} icon={Activity} />
        <StatCard label="Sleep Duration" value={sleepHours ?? "—"} unit="hrs" subtext={g.sleep_duration_seconds ? formatDuration(g.sleep_duration_seconds) : undefined} icon={Moon} />
        <StatCard label="Stress Avg" value={g.stress_avg ?? "—"} unit="/100" icon={Brain} />
        <StatCard label="Recovery Time" value={g.recovery_time_hours ?? "—"} unit="hrs" subtext="Suggested by Garmin" icon={Clock} />
      </div>

      <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-3">Last 30 days</p>
      <HistoryCharts />
    </div>
  );
}

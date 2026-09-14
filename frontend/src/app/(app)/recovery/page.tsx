"use client";
import { mockRecoveryHistory, mockCTLHistory } from "@/lib/mockData";
import { useGarminData } from "@/hooks/useGarminData";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { Moon, Brain, Activity, Clock } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

const Tip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-xs shadow-2xl">
        <p className="text-[#525252] mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RecoveryPage() {
  const { data: g, source } = useGarminData();
  const { plan, loading } = useCoachingPlan();
  const recovery = plan?.recovery;
  const isLive = source === "live";
  const sleepHours = g.sleep_duration_seconds ? (g.sleep_duration_seconds / 3600).toFixed(1) : null;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Biometric Analysis</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Recovery Analytics</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-[#525252]">Garmin Connect</p>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${isLive ? "bg-[#CE0E2D]/10 text-[#CE0E2D] border border-[#CE0E2D]/20" : "bg-[#1a1a1a] text-[#404040] border border-[#222]"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-[#CE0E2D] animate-pulse" : "bg-[#404040]"}`} />
            {isLive ? "Live" : "Demo"}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#525252] mb-6">Loading recovery assessment…</p>
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
          <div key={r.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 flex flex-col items-center justify-center gap-2">
            {r.score !== null ? (
              <ScoreRing score={r.score} label={r.label} size={100} />
            ) : (
              <div className="text-center text-[10px] text-[#404040] uppercase tracking-wider">No {r.label.toLowerCase()} data</div>
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

      <DemoBanner className="mb-4" message="Historical trend charts below use illustrative example data — history tracking isn't built yet." />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* HRV 14-day trend */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">HRV Trend — Example</p>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRecoveryHistory}>
                <defs>
                  <linearGradient id="hrvAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CE0E2D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#CE0E2D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 90]} tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="hrv" stroke="#CE0E2D" fill="url(#hrvAreaGrad)" strokeWidth={2.5} name="HRV" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sleep Quality 14-day */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Sleep Quality — Example</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockRecoveryHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="sleep" fill="#7c3aed" radius={[3, 3, 0, 0]} name="Sleep Score" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Readiness + Body Battery */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Readiness — Example</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockRecoveryHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis domain={[30, 100]} tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Legend formatter={(v) => <span style={{ fontSize: 10, color: "#525252" }}>{v}</span>} />
                <Line type="monotone" dataKey="readiness" stroke="#4ade80" strokeWidth={2} dot={false} name="Readiness" />
                <Line type="monotone" dataKey="bodyBattery" stroke="#fbbf24" strokeWidth={2} dot={false} name="Body Battery" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CTL/ATL */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Load History — Example</p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockCTLHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Legend formatter={(v) => <span style={{ fontSize: 10, color: "#525252" }}>{v}</span>} />
                <Line type="monotone" dataKey="ctl" stroke="#60a5fa" strokeWidth={2} dot={false} name="CTL (Fitness)" />
                <Line type="monotone" dataKey="atl" stroke="#fb923c" strokeWidth={2} dot={false} name="ATL (Fatigue)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

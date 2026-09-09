"use client";
import { mockRecoveryHistory, mockCTLHistory } from "@/lib/mockData";
import { useGarminData } from "@/hooks/useGarminData";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
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
  const { data: g, isLive } = useGarminData();
  const sleepHours = (g.sleep_duration_seconds / 3600).toFixed(1);
  const deepPct = 22;
  const remPct = 18;
  const lightPct = 52;
  const awakePct = 8;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Biometric Analysis</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Recovery Analytics</h1>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-[#525252]">Last 14 days · Garmin Connect</p>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${isLive ? "bg-[#CE0E2D]/10 text-[#CE0E2D] border border-[#CE0E2D]/20" : "bg-[#1a1a1a] text-[#404040] border border-[#222]"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-[#CE0E2D] animate-pulse" : "bg-[#404040]"}`} />
            {isLive ? "Live" : "Demo"}
          </span>
        </div>
      </div>

      <CoachCard
        title="Recovery Assessment — High Readiness"
        message="HRV 81ms is 76% above your 46ms baseline — exceptional readiness today. Sleep at 84/100 with 7h 43m confirms full overnight restoration. Body Battery at 65% shows moderate energy reserves. Training readiness score 82/100 gives you a green light for today's planned session. This is a rare readiness window — make it count."
        type="success"
        metrics={[
          { label: "HRV", value: `${g.hrv_rmssd}ms (+76%)` },
          { label: "Sleep", value: `${g.sleep_score}/100` },
          { label: "Readiness", value: `${g.training_readiness_score}/100` },
          { label: "Risk", value: "Low" },
        ]}
        confidence={0.88}
        agentSource="Recovery Agent · Garmin Live"
        className="mb-6"
      />

      {/* Score Rings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { score: 86, label: "Overall Recovery" },
          { score: g.training_readiness_score, label: "Training Readiness" },
          { score: g.sleep_score, label: "Sleep Quality" },
          { score: g.body_battery_morning, label: "Body Battery" },
        ].map((r) => (
          <div key={r.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 flex flex-col items-center gap-2">
            <ScoreRing score={r.score} label={r.label} size={100} />
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="HRV RMSSD" value={g.hrv_rmssd} unit="ms" subtext={`Baseline ${g.hrv_baseline}ms`} icon={Activity} highlight="success" trend="up" trendValue="+76% baseline" />
        <StatCard label="Sleep Duration" value={sleepHours} unit="hrs" subtext={formatDuration(g.sleep_duration_seconds)} icon={Moon} highlight="success" />
        <StatCard label="Stress Avg" value={g.stress_avg} unit="/100" subtext="Low stress day" icon={Brain} highlight="success" trend="down" trendValue="low" />
        <StatCard label="Recovery Time" value={g.recovery_time_hours} unit="hrs" subtext="Suggested by Garmin" icon={Clock} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* HRV 14-day trend */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">HRV Trend — 14 Days</p>
            <span className="text-[10px] text-[#525252] font-bold">Baseline: {g.hrv_baseline}ms</span>
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
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Sleep Quality — 14 Days</p>
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
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Readiness — 14 Days</p>
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
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Load History — 16 Weeks</p>
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

      {/* Sleep Stages */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Last Night — Sleep Stages</p>
        <div className="flex items-center gap-6 mb-5">
          <div className="text-4xl font-black text-white tabular-nums">
            {sleepHours}<span className="text-base text-[#525252] ml-1 font-bold">hrs</span>
          </div>
          <div className="flex-1 h-3 rounded-full overflow-hidden flex">
            <div className="bg-[#312e81]" style={{ width: `${deepPct}%` }} />
            <div className="bg-[#7c3aed]" style={{ width: `${remPct}%` }} />
            <div className="bg-[#2563eb]" style={{ width: `${lightPct}%` }} />
            <div className="bg-[#1a1a1a]" style={{ width: `${awakePct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { stage: "Deep", pct: deepPct, color: "text-[#818cf8]", mins: Math.round(deepPct / 100 * parseFloat(sleepHours) * 60) },
            { stage: "REM", pct: remPct, color: "text-[#a78bfa]", mins: Math.round(remPct / 100 * parseFloat(sleepHours) * 60) },
            { stage: "Light", pct: lightPct, color: "text-[#60a5fa]", mins: Math.round(lightPct / 100 * parseFloat(sleepHours) * 60) },
            { stage: "Awake", pct: awakePct, color: "text-[#404040]", mins: Math.round(awakePct / 100 * parseFloat(sleepHours) * 60) },
          ].map((s) => (
            <div key={s.stage} className="text-center bg-[#151515] rounded-lg py-3">
              <div className={`text-lg font-black tabular-nums ${s.color}`}>{s.mins}m</div>
              <div className="text-[10px] text-[#525252] font-bold uppercase mt-0.5">{s.stage}</div>
              <div className="text-[10px] text-[#404040]">{s.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

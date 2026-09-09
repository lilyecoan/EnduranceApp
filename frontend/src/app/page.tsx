"use client";
import { Heart, Zap, Moon, Battery, Brain, Activity, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { RaceCountdown } from "@/components/dashboard/RaceCountdown";
import { mockAthleteProfile } from "@/lib/mockData";
import { useGarminData } from "@/hooks/useGarminData";
import { formatDuration } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

const hrv7Day = [
  { day: "Mon", hrv: 52 }, { day: "Tue", hrv: 58 }, { day: "Wed", hrv: 48 },
  { day: "Thu", hrv: 61 }, { day: "Fri", hrv: 72 }, { day: "Sat", hrv: 68 }, { day: "Sun", hrv: 81 },
];

const performanceRadar = [
  { metric: "Swim", value: 62 }, { metric: "Bike", value: 58 },
  { metric: "Run", value: 64 }, { metric: "Endurance", value: 60 },
  { metric: "Recovery", value: 86 }, { metric: "Nutrition", value: 56 },
];

const Tip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-xs shadow-2xl">
      <p className="text-[#525252] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function OverviewPage() {
  const { data: g, isLive } = useGarminData();
  const recoveryScore = 86;
  const readinessScore = g.training_readiness_score;
  const hrvAbove = Math.round(((g.hrv_rmssd - g.hrv_baseline) / g.hrv_baseline) * 100);

  return (
    <div className="p-6 max-w-7xl">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">IronMind AI · Live Dashboard</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Good morning, Lily 👋</h1>
          <p className="text-sm text-[#525252] mt-0.5">Saturday, August 8, 2026 · Galveston 70.3 · 239 days out</p>
        </div>
        {/* Readiness + live indicator */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 bg-[#16a34a]/10 border border-[#16a34a]/25 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
            <span className="text-xs font-bold text-[#4ade80]">
              {hrvAbove >= 20 ? "HIGH" : hrvAbove >= 0 ? "ELEVATED" : "BELOW"} READINESS · HRV +{hrvAbove}%
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${isLive ? "bg-[#CE0E2D]/10 text-[#CE0E2D] border border-[#CE0E2D]/20" : "bg-[#1a1a1a] text-[#404040] border border-[#222]"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-[#CE0E2D] animate-pulse" : "bg-[#404040]"}`} />
            {isLive ? "Garmin Live" : "Demo Data"}
          </div>
        </div>
      </div>

      {/* Coach cards */}
      <CoachCard
        title="Head Coach — Live Garmin Assessment"
        message="HRV 81ms is 76% above your 46ms baseline with excellent sleep at 84/100 (7h 43m). Today's plan upgrades to a tempo run: 10min warm-up → 20min Zone 3 (HR 147–163bpm) → 15min cool-down. Check joints before starting — if any RA discomfort, drop back to Zone 2. This kind of readiness is rare; make it count."
        type="success"
        metrics={[
          { label: "HRV", value: `${g.hrv_rmssd}ms (+${hrvAbove}%)` },
          { label: "Sleep", value: `${g.sleep_score}/100` },
          { label: "Status", value: g.hrv_status },
          { label: "Readiness", value: `${readinessScore}/100` },
        ]}
        confidence={0.88}
        agentSource="Head Coach · Garmin Live"
        className="mb-3"
      />
      <CoachCard
        title="T1D · Tempo Fueling"
        message="Zone 3 effort can spike glucose via catecholamines — don't over-correct. Target 140–170 mg/dL pre-run. Carry glucose tabs. If >200 before start: switch to Zone 2. Check glucose at 90min post-run (delayed hypo risk). ⚠️ Not medical advice."
        type="warning"
        agentSource="Diabetes Agent"
        className="mb-3"
      />
      <CoachCard
        title="Nutrition · All GF Today"
        message="High readiness = higher fuel demand. Pre-workout: GF banana + almond butter. Post-tempo within 30min: rice + salmon. Your insulin sensitivity is elevated today — ideal window for carb uptake post-workout."
        type="info"
        agentSource="Nutrition Agent"
        className="mb-6"
      />

      {/* Recovery scores row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Score rings */}
        <div className="col-span-2 lg:col-span-1 rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Today&apos;s Scores</p>
          <div className="flex items-center justify-around">
            <ScoreRing score={recoveryScore} label="Recovery" size={88} />
            <ScoreRing score={readinessScore} label="Readiness" size={88} />
          </div>
        </div>
        <StatCard label="HRV" value={g.hrv_rmssd} unit="ms" subtext={`Baseline ${g.hrv_baseline}ms`} icon={Activity} highlight="success" trend="up" trendValue={`+${hrvAbove}% baseline`} />
        <StatCard label="Sleep" value={g.sleep_score} unit="/100" subtext={formatDuration(g.sleep_duration_seconds)} icon={Moon} highlight="success" trend="up" trendValue="84 · excellent" />
        <StatCard label="Body Battery" value={g.body_battery_morning} unit="%" subtext="Moderate" icon={Battery} highlight="default" trend="stable" trendValue="moderate" />
      </div>

      {/* Middle row: Load · Race · Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">

        {/* Training Load */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Training Load</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "CTL", value: g.ctl, color: "text-[#60a5fa]", sub: "Fitness" },
              { label: "ATL", value: g.atl, color: "text-[#fb923c]", sub: "Fatigue" },
              { label: "TSB", value: g.tsb, color: (g.tsb ?? 0) >= -5 ? "text-[#4ade80]" : "text-[#fbbf24]", sub: "Form" },
            ].map((m) => (
              <div key={m.label} className="text-center bg-[#151515] rounded-lg py-2.5">
                <div className={`text-lg font-black tabular-nums ${m.color}`}>{m.value}</div>
                <div className="text-[9px] text-[#525252] font-bold uppercase mt-0.5">{m.label}</div>
                <div className="text-[8px] text-[#404040]">{m.sub}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-center py-1.5 rounded-lg bg-[#151515] border border-[#1e1e1e] text-[#525252] font-bold uppercase tracking-wider">
            Base Phase · 34 Weeks Out
          </div>
        </div>

        <RaceCountdown raceDate={mockAthleteProfile.race_date} raceName={mockAthleteProfile.race_name} />

        {/* Radar */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Performance Profile</p>
          <div className="h-[148px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={performanceRadar} cx="50%" cy="50%" outerRadius={52}>
                <PolarGrid stroke="#1e1e1e" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "#525252" }} />
                <Radar name="Level" dataKey="value" stroke="#CE0E2D" fill="#CE0E2D" fillOpacity={0.15} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[9px] text-center text-[#CE0E2D] font-bold uppercase tracking-wider mt-1">
            Recovery: peak today
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="FTP" value={g.ftp} unit="W" subtext={`${mockAthleteProfile.watts_per_kg.toFixed(2)} W/kg`} icon={Zap} trend="up" trendValue="building" />
        <StatCard label="VO₂ Max" value={g.vo2_max} unit="ml/kg/min" subtext="Garmin live" icon={TrendingUp} trend="stable" trendValue="live" />
        <StatCard label="Resting HR" value={g.resting_hr} unit="bpm" subtext="7-day avg" icon={Heart} />
        <StatCard label="Stress" value={g.stress_avg} unit="/100" subtext="Low" icon={Brain} highlight="success" trend="down" trendValue="low" />
      </div>

      {/* HRV chart */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">7-Day HRV Trend</p>
            <p className="text-xs text-[#737373] mt-0.5">Baseline {g.hrv_baseline}ms · <span className="text-[#4ade80] font-semibold">Today {g.hrv_rmssd}ms (+{hrvAbove}%)</span></p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-[#4ade80]">{g.hrv_rmssd}</div>
            <div className="text-[9px] text-[#525252] font-bold uppercase tracking-wider">ms today</div>
          </div>
        </div>
        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hrv7Day}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CE0E2D" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#CE0E2D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={[30, 95]} tick={{ fontSize: 10 }} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="hrv" stroke="#CE0E2D" fill="url(#hrvGrad)" strokeWidth={2.5} name="HRV" dot={{ fill: "#CE0E2D", r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-[#CE0E2D] font-semibold text-center mt-3">
          ↑ Strong upward trend this week — your body is responding to training
        </p>
      </div>
    </div>
  );
}

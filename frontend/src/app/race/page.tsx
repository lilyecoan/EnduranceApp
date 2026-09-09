"use client";
import { mockRaceData, mockAthleteProfile, mockPerformanceTrends } from "@/lib/mockData";
import { daysUntil, weeksUntil, formatDuration, formatPace } from "@/lib/utils";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { useGarminData } from "@/hooks/useGarminData";
import { Bike, Footprints, Waves, Zap, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const r = mockRaceData;
const days = daysUntil(r.race_date);
const weeks = weeksUntil(r.race_date);

const splitData = [
  { segment: "Swim", target: Math.floor(r.split_targets.swim_seconds / 60), color: "#60a5fa" },
  { segment: "T1", target: Math.floor(r.split_targets.t1_seconds / 60), color: "#525252" },
  { segment: "Bike", target: Math.floor(r.split_targets.bike_seconds / 60), color: "#fbbf24" },
  { segment: "T2", target: Math.floor(r.split_targets.t2_seconds / 60), color: "#525252" },
  { segment: "Run", target: Math.floor(r.split_targets.run_seconds / 60), color: "#f87171" },
];

const fuelingPlan = [
  { time: "T-2hr", description: "Full GF meal: rice + eggs + banana", carbs: 80 },
  { time: "T-30min", description: "GF gel + verified GF electrolytes + water", carbs: 28 },
  { time: "Pre-start", description: "Check glucose. Target 140–160 mg/dL (T1D). Carry glucose tabs.", carbs: 0 },
  { time: "Swim", description: "Nothing (can't eat) — glucose check in T1", carbs: 0 },
  { time: "T1", description: "Quick GF gel + check glucose", carbs: 25 },
  { time: "Bike 0–20min", description: "Water only — let glucose and stomach stabilize", carbs: 0 },
  { time: "Bike every 20min", description: "1 GF gel (25g) + 500ml water + verified GF salt tab", carbs: 25 },
  { time: "Bike end", description: "Maintain 60g carbs/hr — GF rice balls or gels", carbs: 60 },
  { time: "T2", description: "Check glucose. Quick GF gel + water if needed.", carbs: 20 },
  { time: "Run every 2km", description: "Aid station water + GF gel every 20min", carbs: 20 },
  { time: "Run final 3km", description: "GF cola or caffeinated GF gel if legal on course", carbs: 20 },
];

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

export default function RacePage() {
  const { data: g } = useGarminData();
  const predictedFinish = formatDuration(r.predicted_finish_seconds);

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Race Day</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Race Strategy</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            {r.race_name} · {new Date(r.race_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <p className="text-xs text-[#404040] mt-0.5">Flat coastal course · March conditions (~65°F, wind off Gulf of Mexico) · Wetsuit likely legal</p>
        </div>
        <div className="text-right rounded-xl border border-[#CE0E2D]/20 bg-[#CE0E2D]/5 px-5 py-3">
          <div className="text-3xl font-black text-white tabular-nums">{days}</div>
          <div className="text-[9px] text-[#CE0E2D] font-bold uppercase tracking-widest">{weeks} weeks to race</div>
        </div>
      </div>

      <CoachCard
        title="Race Strategy — Base Phase (34 weeks out)"
        message={`With ${weeks} weeks to race, you are deep in base building. Current fitness predicts a ${predictedFinish} finish — this will improve significantly as FTP and run fitness develop. Your priority now is building the aerobic engine, not race-specific fitness. Race pace targeting becomes relevant at ~12 weeks out.`}
        type="info"
        metrics={[
          { label: "Predicted Finish", value: predictedFinish },
          { label: "Bike Target", value: `${r.bike_watts_target}W (76% of ${g.ftp ?? 128}W FTP)` },
          { label: "Run Target", value: formatPace(r.run_pace_target) },
          { label: "Swim Pace", value: `${r.swim_pace_per_100yd}s/100yd` },
        ]}
        confidence={0.72}
        agentSource="Race Strategy Agent"
        className="mb-3"
      />

      <CoachCard
        title="T1D + Celiac Race Day Protocol"
        message="Critical: Brief race medical team on T1D at athlete check-in. Carry glucose tabs in tri-suit pocket throughout (swim, bike, run). ALL race-day nutrition must be pre-verified GF — do NOT use aid station food without verification. Practice complete race nutrition protocol in every long training session. Agree insulin strategy with your endocrinologist at least 8 weeks before race day. ⚠️ Not medical advice."
        type="warning"
        agentSource="Diabetes + Nutrition Agents"
        className="mb-6"
      />

      {/* Predicted Finish + Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Finish card */}
        <div className="rounded-xl border border-[#CE0E2D]/20 bg-[#CE0E2D]/5 p-6">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Predicted Finish Time (Current Fitness)</p>
          <div className="text-5xl font-black text-white tracking-tight tabular-nums">{predictedFinish}</div>
          <p className="text-sm text-[#525252] mt-2">Projected to improve 20–35+ minutes over the next 34 weeks</p>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-[#CE0E2D]/15">
            <div>
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Waves className="w-3 h-3" /> Swim
              </div>
              <div className="text-sm font-black text-[#60a5fa]">{formatDuration(r.split_targets.swim_seconds)}</div>
              <div className="text-[10px] text-[#404040]">{r.swim_pace_per_100yd}s/100yd</div>
            </div>
            <div>
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Bike className="w-3 h-3" /> Bike
              </div>
              <div className="text-sm font-black text-[#fbbf24]">{formatDuration(r.split_targets.bike_seconds)}</div>
              <div className="text-[10px] text-[#404040]">{r.bike_watts_target}W target</div>
            </div>
            <div>
              <div className="text-[10px] text-[#525252] mb-1 flex items-center gap-1 font-bold uppercase">
                <Footprints className="w-3 h-3" /> Run
              </div>
              <div className="text-sm font-black text-[#f87171]">{formatDuration(r.split_targets.run_seconds)}</div>
              <div className="text-[10px] text-[#404040]">{formatPace(r.run_pace_target)}</div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-[#151515] border border-[#1e1e1e]">
            <p className="text-[10px] text-[#525252] leading-relaxed">Galveston 70.3 is a flat, fast course — ideal for a first 70.3. March weather (~65°F) is excellent for performance. Wind off the Gulf can be significant on the bike — practice riding in wind.</p>
          </div>
        </div>

        {/* Split chart */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Split Time Distribution (minutes)</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e1e1e" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#525252" }} unit="m" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="segment" tick={{ fontSize: 11, fill: "#737373" }} width={40} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="target" radius={[0, 4, 4, 0]} name="Minutes" fill="#CE0E2D" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FTP + VO2 trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">FTP Trend — Building to {g.ftp ?? 128}W</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockPerformanceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis domain={[100, 160]} tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Line type="monotone" dataKey="ftp" stroke="#fbbf24" strokeWidth={2.5} dot={false} name="FTP (W)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-[#4ade80]" />
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">VO₂ Max Trend — 12 Months</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockPerformanceTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, 52]} tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Line type="monotone" dataKey="vo2max" stroke="#4ade80" strokeWidth={2.5} dot={false} name="VO₂max" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Race Day Fueling */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">Race Day Fueling — All GF Verified</p>
          <span className="text-[10px] text-[#fbbf24] bg-[#d97706]/10 border border-[#d97706]/20 px-2 py-1 rounded font-bold">Celiac Protocol</span>
        </div>
        <div className="space-y-0">
          {fuelingPlan.map((item, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 border-b border-[#1e1e1e] last:border-0">
              <div className="w-28 flex-shrink-0">
                <span className="text-[10px] font-black text-[#CE0E2D] bg-[#CE0E2D]/10 px-2 py-0.5 rounded font-mono">{item.time}</span>
              </div>
              <div className="flex-1 text-[12px] text-[#737373]">{item.description}</div>
              {item.carbs > 0 && (
                <div className="text-xs font-black text-[#60a5fa] flex-shrink-0 bg-[#2563eb]/10 px-2 py-0.5 rounded">{item.carbs}g</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[#1e1e1e] space-y-1.5">
          <p className="text-[11px] text-[#fbbf24] font-bold">Practice this EXACTLY in your Saturday long ride and Sunday brick — every single session.</p>
          <p className="text-[10px] text-[#404040]">Total race carbs: ~200–250g (bike: ~180g, run: ~60g). Confirm all products GF at home before race week.</p>
        </div>
      </div>
    </div>
  );
}

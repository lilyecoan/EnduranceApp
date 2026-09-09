"use client";
import { mockAthleteProfile } from "@/lib/mockData";
import { useGarminData } from "@/hooks/useGarminData";
import { StatCard } from "@/components/dashboard/StatCard";
import { Zap, Heart, Activity, Target, AlertCircle, CheckCircle, Info } from "lucide-react";
import { formatPace } from "@/lib/utils";

const p = mockAthleteProfile;

const hrZones = [
  { zone: "Z1", name: "Active Recovery", range: "< 118 bpm", pct: "< 60% HR", bar: "bg-[#1e3a5f]" },
  { zone: "Z2", name: "Aerobic Base", range: "118–147 bpm", pct: "60–75% HR", bar: "bg-[#14532d]" },
  { zone: "Z3", name: "Tempo", range: "147–163 bpm", pct: "75–83% HR", bar: "bg-[#713f12]" },
  { zone: "Z4", name: "Threshold", range: "163–176 bpm", pct: "83–90% HR", bar: "bg-[#7c2d12]" },
  { zone: "Z5", name: "VO₂ Max", range: "> 176 bpm", pct: "> 90% HR", bar: "bg-[#CE0E2D]/80" },
];

const powerZones = [
  { zone: "Z1", name: "Active Recovery", range: "< 77W", pct: "< 60% FTP" },
  { zone: "Z2", name: "Endurance", range: "77–102W", pct: "60–80% FTP" },
  { zone: "Z3", name: "Tempo", range: "102–115W", pct: "80–90% FTP" },
  { zone: "Z4", name: "Threshold", range: "115–134W", pct: "90–105% FTP" },
  { zone: "Z5", name: "VO₂ Max", range: "134–154W", pct: "105–120% FTP" },
  { zone: "Z6", name: "Anaerobic", range: "> 154W", pct: "> 120% FTP" },
];

const medicalConditions = [
  {
    name: "Type 1 Diabetes",
    border: "border-[#CE0E2D]/25 bg-[#CE0E2D]/5",
    label: "text-[#f87171]",
    badge: "bg-[#CE0E2D]/15 text-[#f87171] border border-[#CE0E2D]/20",
    impact: "Blood glucose management during exercise. Pre/intra/post-workout glucose monitoring required.",
    coachNote: "Target 130–160 mg/dL pre-exercise. Carry fast-acting glucose always. Monitor for 2h post-exercise (delayed hypoglycemia risk). Check with your endocrinologist for race-day insulin protocol.",
  },
  {
    name: "Celiac Disease",
    border: "border-[#d97706]/25 bg-[#d97706]/5",
    label: "text-[#fbbf24]",
    badge: "bg-[#d97706]/15 text-[#fbbf24] border border-[#d97706]/20",
    impact: "Strict gluten-free diet required. All nutrition products, gels, and race-day food must be certified GF.",
    coachNote: "Pre-verify all race nutrition (gels, bars, chews). Bring your own GF race food — aid station products may not be GF. Rice-based carbohydrates are excellent GF fueling options.",
  },
  {
    name: "Hashimoto's Thyroiditis",
    border: "border-[#7c3aed]/25 bg-[#7c3aed]/5",
    label: "text-[#a78bfa]",
    badge: "bg-[#7c3aed]/15 text-[#a78bfa] border border-[#7c3aed]/20",
    impact: "Can cause fatigue, slower recovery, cold intolerance, and variable energy levels.",
    coachNote: "Monitor energy trends. If unexplained fatigue persists beyond 3–4 days, reduce training load. HRV may be a better readiness indicator for you than perceived exertion alone. Discuss TSH levels with your physician periodically.",
  },
  {
    name: "Rheumatoid Arthritis",
    border: "border-[#d97706]/25 bg-[#d97706]/5",
    label: "text-[#fb923c]",
    badge: "bg-[#d97706]/15 text-[#fb923c] border border-[#d97706]/20",
    impact: "Joint inflammation affects impact tolerance, especially knees, hips, and hands.",
    coachNote: "On flare days: replace runs with pool running or cycling. Avoid sudden volume increases in running. Anti-inflammatory nutrition (omega-3, turmeric, leafy greens) supports joint health. Never push through joint pain.",
  },
];

export default function ProfilePage() {
  const { data: g } = useGarminData();
  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Athlete Profile</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Lily Coan</h1>
        <p className="text-sm text-[#525252] mt-0.5">Connected to Garmin Connect · Last synced: Today</p>
      </div>

      {/* Profile Header Card */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] overflow-hidden mb-6">
        <div className="bg-[#CE0E2D] px-5 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-lg font-black text-white flex-shrink-0">
            LC
          </div>
          <div>
            <div className="text-sm font-black text-white">{p.name}</div>
            <div className="text-[10px] text-white/70">Age {p.age} · {p.weight_lb} lbs · Ironman 70.3 Athlete</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Race Goal</div>
            <div className="text-xs font-black text-white">{p.race_name}</div>
          </div>
        </div>
        <div className="p-5">
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Base Phase", color: "text-[#60a5fa] bg-[#2563eb]/10 border-[#2563eb]/20" },
              { label: "T1D", color: "text-[#f87171] bg-[#CE0E2D]/10 border-[#CE0E2D]/20" },
              { label: "Celiac", color: "text-[#fbbf24] bg-[#d97706]/10 border-[#d97706]/20" },
              { label: "Hashimoto's", color: "text-[#a78bfa] bg-[#7c3aed]/10 border-[#7c3aed]/20" },
              { label: "RA", color: "text-[#fb923c] bg-[#d97706]/10 border-[#d97706]/20" },
              { label: "Garmin Connected", color: "text-[#4ade80] bg-[#16a34a]/10 border-[#16a34a]/20" },
            ].map((t) => (
              <span key={t.label} className={`text-[10px] font-bold px-3 py-1 rounded-full border ${t.color}`}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-6">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Performance Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="FTP" value={g.ftp} unit="W" subtext={`${p.watts_per_kg.toFixed(2)} W/kg · Building`} icon={Zap} />
          <StatCard label="VO₂ Max" value={g.vo2_max} unit="ml/kg/min" subtext="Intermediate base" icon={Activity} />
          <StatCard label="Resting HR" value={g.resting_hr} unit="bpm" subtext="Good cardiac fitness" icon={Heart} />
          <StatCard label="Swim Pace" value="1:50" unit="/100yd" subtext="Building efficiency" icon={Activity} />
          <StatCard label="Run Pace (easy)" value={formatPace(g.run_threshold_pace)} unit="" subtext="Threshold pace" icon={Activity} />
          <StatCard label="Max HR (est)" value={p.max_hr} unit="bpm" subtext="Age-predicted" icon={Heart} />
        </div>
      </div>

      {/* Strengths / Limiters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/5 p-4">
          <h3 className="text-xs font-black text-[#4ade80] mb-3 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Strengths
          </h3>
          <ul className="space-y-2">
            {[
              "Consistent training discipline",
              "Strong mental toughness (5 conditions)",
              "Excellent HRV + aerobic base today",
              "40 weeks of build time available",
            ].map((s) => (
              <li key={s} className="text-sm text-[#737373] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#d97706]/20 bg-[#d97706]/5 p-4">
          <h3 className="text-xs font-black text-[#fbbf24] mb-3 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" /> Key Limiters
          </h3>
          <ul className="space-y-2">
            {[
              "Bike power (FTP 128W → 2.01 W/kg)",
              "Swim efficiency (open water)",
              "Managing 5 concurrent conditions",
              "Race nutrition with celiac constraints",
            ].map((s) => (
              <li key={s} className="text-sm text-[#737373] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Medical Conditions */}
      <div className="mb-6">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#fbbf24]" /> Medical Conditions & Coaching Adjustments
        </p>
        <div className="space-y-3">
          {medicalConditions.map((c) => (
            <div key={c.name} className={`rounded-xl border p-4 ${c.border}`}>
              <div className="flex items-start justify-between mb-2">
                <h4 className={`text-sm font-black ${c.label}`}>{c.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.badge}`}>Active</span>
              </div>
              <p className="text-xs text-[#525252] mb-2 leading-relaxed">{c.impact}</p>
              <div className="flex items-start gap-2 bg-[#151515] rounded-lg p-2.5">
                <Info className="w-3.5 h-3.5 text-[#525252] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#737373] leading-relaxed">{c.coachNote}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-xl border border-[#d97706]/20 bg-[#d97706]/5 mb-6">
        <p className="text-xs text-[#737373]">
          ⚠️ <strong className="text-[#fbbf24]">Medical Disclaimer:</strong> All coaching suggestions from IronMind AI are general training support information only.
          They are NOT medical advice and must not replace guidance from your endocrinologist, rheumatologist, thyroid specialist, or any other physician.
          Always consult your care team before making changes to your medical management, especially around exercise and diabetes management.
        </p>
      </div>

      {/* Training Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-0.5">Heart Rate Zones</p>
          <p className="text-[10px] text-[#404040] mb-3">Max HR: {p.max_hr} bpm (estimated) · LT: ~{p.lactate_threshold_hr} bpm</p>
          <div className="space-y-2">
            {hrZones.map((z) => (
              <div key={z.zone} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#151515] border border-[#1e1e1e]">
                <div className={`w-1.5 h-6 rounded-full ${z.bar} flex-shrink-0`} />
                <span className="text-[10px] font-black text-[#525252] w-5">{z.zone}</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white">{z.name}</div>
                  <div className="text-[10px] text-[#404040]">{z.pct}</div>
                </div>
                <span className="text-[10px] text-[#737373] font-mono">{z.range}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-0.5">Cycling Power Zones</p>
          <p className="text-[10px] text-[#404040] mb-3">FTP: {g.ftp}W · {p.watts_per_kg.toFixed(2)} W/kg</p>
          <div className="space-y-2">
            {powerZones.map((z, i) => (
              <div key={z.zone} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#151515] border border-[#1e1e1e]">
                <div
                  className="w-1.5 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `hsl(${200 + i * 25}, 80%, ${45 + i * 5}%)` }}
                />
                <span className="text-[10px] font-black text-[#525252] w-5">{z.zone}</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white">{z.name}</div>
                  <div className="text-[10px] text-[#404040]">{z.pct}</div>
                </div>
                <span className="text-[10px] text-[#fbbf24] font-mono">{z.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

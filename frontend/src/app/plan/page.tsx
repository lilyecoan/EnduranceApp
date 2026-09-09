"use client";
import { mockWeeklyPlan } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Bike, Footprints, Waves, Coffee, Dumbbell } from "lucide-react";

const sportIcon: Record<string, React.ElementType> = {
  Run: Footprints, Swim: Waves, Bike: Bike,
};

const sportStyle: Record<string, { border: string; bg: string; dot: string; label: string }> = {
  Swim: { border: "border-[#2563eb]/30", bg: "bg-[#2563eb]/5",   dot: "bg-[#60a5fa]", label: "text-[#60a5fa]" },
  Bike: { border: "border-[#d97706]/30", bg: "bg-[#d97706]/5",   dot: "bg-[#fbbf24]", label: "text-[#fbbf24]" },
  Run:  { border: "border-[#CE0E2D]/30", bg: "bg-[#CE0E2D]/5",   dot: "bg-[#f87171]", label: "text-[#f87171]" },
};

const intensityBadge: Record<string, string> = {
  "Zone 1":   "bg-[#1e3a5f] text-[#93c5fd] border-[#2563eb]/30",
  "Zone 2":   "bg-[#14532d] text-[#4ade80] border-[#16a34a]/30",
  "Zone 3":   "bg-[#713f12] text-[#fbbf24] border-[#d97706]/30",
  "Zone 3–4": "bg-[#7c2d12] text-[#fb923c] border-[#ea580c]/30",
  "Zone 4":   "bg-[#7f1d1d] text-[#f87171] border-[#CE0E2D]/30",
  "Zone 2–3": "bg-[#134e4a] text-[#34d399] border-[#059669]/30",
};

export default function PlanPage() {
  const weekTSS   = mockWeeklyPlan.reduce((s, d) => s + (d.workout?.tss ?? 0) + (d.strength?.tss ?? 0), 0);
  const weekHours = mockWeeklyPlan.reduce((s, d) => s + (d.workout?.duration_min ?? 0) + (d.strength?.duration_min ?? 0), 0) / 60;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Weekly Schedule</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Training Plan</h1>
          <p className="text-sm text-[#525252] mt-0.5">Aug 3–9, 2026 · Base Phase · Week 10 of 34</p>
        </div>
        <div className="flex gap-5">
          <div className="text-right">
            <div className="text-2xl font-black text-white">{weekTSS}</div>
            <div className="text-[9px] text-[#525252] font-bold uppercase tracking-widest">TSS</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-white">{weekHours.toFixed(1)}h</div>
            <div className="text-[9px] text-[#525252] font-bold uppercase tracking-widest">Volume</div>
          </div>
        </div>
      </div>

      {/* Phase banner */}
      <div className="rounded-xl border border-[#CE0E2D]/20 bg-[#CE0E2D]/5 p-4 mb-6 flex items-center gap-4">
        <div className="w-1 h-12 bg-[#CE0E2D] rounded-full flex-shrink-0" />
        <div>
          <div className="text-sm font-black text-white mb-0.5">Base Phase — Swim-Heavy + Strength Foundation</div>
          <p className="text-xs text-[#737373] leading-relaxed">
            3 swims · 2 bikes · 1 run · 2 strength doubles. Mon and Sun are double days — swim first, strength after a short rest.
            Saturday long ride is the key endurance session. RA: bodyweight only on flare days. Check glucose before every swim.
          </p>
        </div>
      </div>

      {/* Calendar */}
      <div className="space-y-2">
        {mockWeeklyPlan.map((day) => {
          if (day.rest || !day.workout) {
            return (
              <div key={day.day} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 flex items-center gap-4">
                <div className="w-14 text-center flex-shrink-0">
                  <div className="text-sm font-black text-[#404040]">{day.day}</div>
                  <div className="text-[9px] text-[#303030]">{day.date}</div>
                </div>
                <Coffee className="w-4 h-4 text-[#404040]" />
                <div>
                  <div className="text-sm font-bold text-[#404040]">Rest Day</div>
                  <div className="text-[11px] text-[#333]">Walk, mobility, or full rest. Recovery is training.</div>
                </div>
              </div>
            );
          }

          const w   = day.workout;
          const str = "strength" in day ? day.strength : undefined;
          const Icon = sportIcon[w.sport] ?? Footprints;
          const ss   = sportStyle[w.sport] ?? sportStyle.Run;
          const ib   = intensityBadge[w.intensity ?? "Zone 2"] ?? "";

          return (
            <div key={day.day} className="space-y-1.5">
              {/* Primary workout */}
              <div className={cn("rounded-xl border p-4 transition-all", ss.border, ss.bg)}>
                <div className="flex items-start gap-4">
                  {/* Day */}
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className="text-sm font-black text-white">{day.day}</div>
                    <div className="text-[9px] text-[#525252]">{day.date}</div>
                    {str && (
                      <div className="text-[8px] font-black text-[#CE0E2D] uppercase tracking-wider mt-1">AM</div>
                    )}
                  </div>

                  {/* Sport dot + icon */}
                  <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                    <div className={cn("w-2 h-2 rounded-full", ss.dot)} />
                    <Icon className={cn("w-4 h-4", ss.label)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-white">{w.name}</span>
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", ib)}>
                        {w.intensity}
                      </span>
                      <span className="text-[9px] text-[#404040] font-bold bg-[#151515] px-2 py-0.5 rounded">TSS {w.tss}</span>
                    </div>
                    <p className="text-[12px] text-[#737373] leading-relaxed">{w.notes}</p>

                    {"fueling" in w && w.fueling && (
                      <div className="flex gap-4 text-[9px] text-[#525252] bg-[#151515] rounded-lg px-3 py-2 mt-2 font-medium">
                        <span>🍬 {w.fueling.carbs_per_hour}g/hr GF carbs</span>
                        <span>💧 {w.fueling.water_oz_per_hour} oz/hr</span>
                        <span>🧂 {w.fueling.sodium_mg_per_hour}mg Na/hr</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 flex-shrink-0 text-right">
                    <div>
                      <div className="text-sm font-black text-white">{w.duration_min}m</div>
                      <div className="text-[9px] text-[#404040] font-bold uppercase">Time</div>
                    </div>
                    {"distance_yards" in w && w.distance_yards && (
                      <div>
                        <div className="text-sm font-black text-white">{w.distance_yards.toLocaleString()}yd</div>
                        <div className="text-[9px] text-[#404040] font-bold uppercase">Dist</div>
                      </div>
                    )}
                    {"distance_mi" in w && w.distance_mi && (
                      <div>
                        <div className="text-sm font-black text-white">{w.distance_mi}mi</div>
                        <div className="text-[9px] text-[#404040] font-bold uppercase">Dist</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Strength session (double day) */}
              {str && (
                <div className="rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4 ml-4">
                  <div className="flex items-start gap-4">
                    {/* PM label */}
                    <div className="w-10 flex-shrink-0 text-center pt-0.5">
                      <div className="text-[8px] font-black text-[#a78bfa] uppercase tracking-wider">PM</div>
                    </div>

                    {/* Icon */}
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
                      <Dumbbell className="w-4 h-4 text-[#a78bfa]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-white">{str.name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[#4a1d96] text-[#c4b5fd] border-[#7c3aed]/30">
                          {str.focus === "lower" ? "Lower Body" : "Full Body"}
                        </span>
                        <span className="text-[9px] text-[#404040] font-bold bg-[#151515] px-2 py-0.5 rounded">TSS {str.tss}</span>
                      </div>
                      <p className="text-[12px] text-[#737373] leading-relaxed">{str.notes}</p>
                    </div>

                    {/* Duration */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-black text-white">{str.duration_min}m</div>
                      <div className="text-[9px] text-[#404040] font-bold uppercase">Time</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Week summary */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          { label: "🏊 Swim",     time: "2h 10m", vol: "4,100yd · 3×",  color: "text-[#60a5fa]" },
          { label: "🚴 Bike",     time: "2h 30m", vol: "39.8mi · 2×",   color: "text-[#fbbf24]" },
          { label: "🏃 Run",      time: "40m",    vol: "3.4mi · 1×",    color: "text-[#f87171]" },
          { label: "💪 Strength", time: "1h 10m", vol: "2 doubles",      color: "text-[#a78bfa]" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-3 text-center">
            <div className={cn("text-xs font-bold", s.color)}>{s.label}</div>
            <div className="text-lg font-black text-white mt-1">{s.time}</div>
            <div className="text-[9px] text-[#525252]">{s.vol}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

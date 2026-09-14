"use client";
import { mockNutritionDay } from "@/lib/mockData";
import { Droplets, Flame, Zap, Beef, GlassWater } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { DemoBanner } from "@/components/dashboard/DemoBanner";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Tip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { cal: number } }[] }) => {
  if (active && payload?.length) {
    const item = payload[0];
    return (
      <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-3 text-xs shadow-2xl">
        <p className="font-bold text-white">{item.name}</p>
        <p className="text-[#525252]">{item.value}g{item.payload.cal ? ` · ${item.payload.cal} kcal` : ""}</p>
      </div>
    );
  }
  return null;
};

export default function NutritionPage() {
  const { plan, loading } = useCoachingPlan();
  const n = plan?.nutrition;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const macroData = n
    ? [
        { name: "Carbs", value: n.carbs_g, color: "#60a5fa", cal: Math.round(n.carbs_g * 4) },
        { name: "Protein", value: n.protein_g, color: "#4ade80", cal: Math.round(n.protein_g * 4) },
        { name: "Fat", value: n.fat_g, color: "#fbbf24", cal: Math.round(n.fat_g * 9) },
      ]
    : [];

  const carbPercent = n ? Math.round(((n.carbs_g * 4) / n.daily_calories) * 100) : 0;
  const proteinPercent = n ? Math.round(((n.protein_g * 4) / n.daily_calories) * 100) : 0;
  const fatPercent = n ? Math.round(((n.fat_g * 9) / n.daily_calories) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Daily Fuel</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Nutrition Plan</h1>
        <p className="text-sm text-[#525252] mt-0.5">
          {today}
          {n && !n.has_scheduled_workout && " · No workout scheduled — rest-day estimate"}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#525252] mb-6">Loading today&apos;s nutrition plan…</p>
      ) : !n ? (
        <p className="text-sm text-[#525252] mb-6">Unable to load a nutrition plan right now.</p>
      ) : (
        <>
          <CoachCard
            title="Nutrition Strategy — Today"
            message={n.reasoning}
            type="info"
            agentSource="Nutrition Agent"
            className="mb-6"
          />

          {/* Macro Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Daily Calories" value={n.daily_calories.toLocaleString()} unit="kcal" icon={Flame} />
            <StatCard label="Carbohydrates" value={n.carbs_g} unit="g" subtext={`${carbPercent}%`} icon={Zap} />
            <StatCard label="Protein" value={n.protein_g} unit="g" subtext={`${proteinPercent}%`} icon={Beef} highlight="success" />
            <StatCard label="Fat" value={n.fat_g} unit="g" subtext={`${fatPercent}%`} icon={Droplets} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Macro Pie */}
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Macro Distribution</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={macroData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {macroData.map((m) => (
                        <Cell key={m.name} fill={m.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                    <Legend formatter={(value) => <span style={{ color: "#525252", fontSize: 11 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hydration */}
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Hydration & Electrolytes</p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                    <GlassWater className="w-5 h-5 text-[#60a5fa]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-white">Fluid</span>
                      <span className="text-xs text-[#60a5fa] font-black">{n.hydration_ml_per_hour} ml/hr</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#d97706]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#fbbf24] text-sm font-black">Na</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-white">Sodium</span>
                      <span className="text-xs text-[#fbbf24] font-black">{n.sodium_mg_per_hour}mg/hr</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workout Fueling */}
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Workout Fueling</p>
              {n.has_scheduled_workout ? (
                <div className="space-y-3">
                  {n.pre_workout_carbs_g != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#737373]">Pre-workout</span>
                      <span className="text-[10px] font-black text-[#CE0E2D] bg-[#CE0E2D]/10 px-2 py-0.5 rounded">
                        {n.pre_workout_carbs_g}g carbs
                      </span>
                    </div>
                  )}
                  {n.intra_carbs_g_per_hour != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#737373]">During workout</span>
                      <span className="text-[10px] font-black text-[#CE0E2D] bg-[#CE0E2D]/10 px-2 py-0.5 rounded">
                        {n.intra_carbs_g_per_hour}g/hr
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#525252]">No workout scheduled today.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Illustrative meal timeline — no per-meal generation endpoint exists yet */}
      <DemoBanner className="mb-4" message="Example meal timeline below — not generated from your actual data." />
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-5">Example Meal Timeline</p>
        <div className="space-y-0">
          {mockNutritionDay.fueling_timeline.map((meal, i) => (
            <div key={i} className="flex gap-4 relative">
              {i < mockNutritionDay.fueling_timeline.length - 1 && (
                <div className="absolute left-[27px] top-8 w-px h-[calc(100%-8px)] bg-[#1e1e1e]" />
              )}
              <div className="w-14 text-[10px] text-[#404040] pt-1.5 flex-shrink-0 text-right">{meal.time}</div>
              <div className="w-3 h-3 rounded-full bg-[#CE0E2D]/30 border-2 border-[#CE0E2D]/50 mt-2 flex-shrink-0 z-10" />
              <div className="flex-1 pb-5">
                <div className="rounded-lg border border-[#1e1e1e] bg-[#151515] p-3">
                  <div className="text-xs font-bold text-white mb-1">{meal.item}</div>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-[#60a5fa]">{meal.carbs_g}g carbs</span>
                    <span className="text-[#4ade80]">{meal.protein_g}g protein</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

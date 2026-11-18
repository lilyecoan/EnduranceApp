"use client";
import { Droplets, Flame, Zap, Beef, GlassWater } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { dietFrom, splitMeals } from "@/lib/mealSplit";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { useUnits } from "@/components/units/UnitsProvider";
import { formatFluidPerHour } from "@/lib/units";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Tip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { cal: number } }[] }) => {
  if (active && payload?.length) {
    const item = payload[0];
    return (
      <div className="bg-surface border border-stroke rounded-lg p-3 text-xs shadow-2xl">
        <p className="font-bold text-white">{item.name}</p>
        <p className="text-muted">{item.value}g{item.payload.cal ? ` · ${item.payload.cal} kcal` : ""}</p>
      </div>
    );
  }
  return null;
};

export default function NutritionPage() {
  const { plan, loading } = useCoachingPlan();
  const { profile } = useAthleteProfile();
  const { units } = useUnits();
  const n = plan?.nutrition;
  const training = !!n && n.day_type !== undefined && n.day_type !== "rest";
  const meals = n
    ? splitMeals(n.carbs_g, n.protein_g, {
        training,
        weightKg: profile?.weight_kg ?? null,
        preCarbs: n.pre_workout_carbs_g,
        diet: dietFrom(profile?.dietary_restrictions),
      })
    : [];
  const sportName: Record<string, string> = { running: "run", cycling: "ride", swimming: "swim", strength: "strength session" };
  const basis = !n
    ? ""
    : n.workout_source === "done"
      ? `Based on your ${n.workout_minutes} min ${sportName[n.workout_sport ?? ""] ?? "workout"} today`
      : n.workout_source === "planned"
        ? `Based on today's planned ${n.workout_minutes} min ${sportName[n.workout_sport ?? ""] ?? "session"}`
        : "No workout synced or logged yet today: rest-day targets";

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
    <div className="px-5 py-7 lg:px-10 lg:py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted mb-1.5">Daily Fuel</p>
        <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px]">Nutrition Plan</h1>
        <p className="text-sm text-muted mt-0.5">
          {today}
          {basis && ` · ${basis}`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted mb-6">Loading today&apos;s nutrition plan…</p>
      ) : !n ? (
        <p className="text-sm text-muted mb-6">Unable to load a nutrition plan right now.</p>
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
            <div className="rounded-[24px] border border-stroke bg-surface p-4">
              <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-4">Macro Distribution</p>
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
            <div className="rounded-[24px] border border-stroke bg-surface p-4">
              <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-4">Hydration & Electrolytes</p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[24px] bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                    <GlassWater className="w-5 h-5 text-[#60a5fa]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-white">Fluid</span>
                      <span className="text-xs text-[#60a5fa] font-semibold">{formatFluidPerHour(n.hydration_ml_per_hour, units)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[24px] bg-[#d97706]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#fbbf24] text-sm font-semibold">Na</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-white">Sodium</span>
                      <span className="text-xs text-[#fbbf24] font-semibold">{n.sodium_mg_per_hour}mg/hr</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workout Fueling */}
            <div className="rounded-[24px] border border-stroke bg-surface p-4">
              <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-4">Workout Fueling</p>
              {training ? (
                <div className="space-y-3">
                  {n.pre_workout_carbs_g != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Pre-workout</span>
                      <span className="text-[10px] font-semibold text-lime bg-lime/10 px-2 py-0.5 rounded">
                        {n.pre_workout_carbs_g}g carbs
                      </span>
                    </div>
                  )}
                  {n.intra_carbs_g_per_hour != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">During workout</span>
                      <span className="text-[10px] font-semibold text-lime bg-lime/10 px-2 py-0.5 rounded">
                        {n.intra_carbs_g_per_hour}g/hr
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">Rest day: no workout fueling needed. Targets update automatically when a workout syncs or you log one.</p>
              )}
            </div>
          </div>
        </>
      )}

      {n && (
        <div className="rounded-[24px] border border-stroke bg-surface p-5">
          <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
            <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em]">Spread across your day</p>
            <p className="text-[10px] text-muted">
              Suggested split of today&apos;s targets{profile?.dietary_restrictions ? " · ideas follow your dietary notes" : ""}
            </p>
          </div>
          <div className="space-y-0">
            {meals.map((meal, i) => (
              <div key={meal.name} className="flex gap-4 relative">
                {i < meals.length - 1 && <div className="absolute left-[5px] top-6 w-px h-[calc(100%-12px)] bg-stroke" />}
                <div className="w-3 h-3 rounded-full bg-lime mt-1.5 flex-shrink-0 z-10" />
                <div className="flex-1 pb-5 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-fg">{meal.name}</span>
                    <span className="text-[11px] text-muted">{meal.when}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{meal.ideas}</p>
                  <div className="flex gap-2 mt-2 text-[11px] font-medium">
                    <span className="bg-surface2 rounded-full px-2.5 py-1 text-fg">{meal.carbs_g} g carbs</span>
                    {meal.protein_g > 0 && <span className="bg-surface2 rounded-full px-2.5 py-1 text-fg">{meal.protein_g} g protein</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">General guidance, not medical or dietitian advice.{profile?.has_type1_diabetes ? " With T1D, match insulin to these carbs with your care team's plan." : ""}</p>
        </div>
      )}
    </div>
  );
}

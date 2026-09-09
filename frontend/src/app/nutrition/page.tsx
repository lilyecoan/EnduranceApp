"use client";
import { mockNutritionDay, mockAthleteProfile } from "@/lib/mockData";
import { Droplets, Flame, Zap, Beef, GlassWater, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { CoachCard } from "@/components/dashboard/CoachCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const n = mockNutritionDay;
const p = mockAthleteProfile;

const macroData = [
  { name: "Carbs", value: n.carbs_g, color: "#60a5fa", cal: n.carbs_g * 4 },
  { name: "Protein", value: n.protein_g, color: "#4ade80", cal: n.protein_g * 4 },
  { name: "Fat", value: n.fat_g, color: "#fbbf24", cal: n.fat_g * 9 },
];

const weeklyCarbs = [
  { day: "Mon", carbs: 280, target: 310 },
  { day: "Tue", carbs: 295, target: 310 },
  { day: "Wed", carbs: 340, target: 360 },
  { day: "Thu", carbs: 265, target: 280 },
  { day: "Fri", carbs: 210, target: 230 },
  { day: "Sat", carbs: 380, target: 400 },
  { day: "Sun", carbs: 310, target: 320 },
];

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
  const carbPercent = Math.round((n.carbs_g * 4 / n.daily_calories) * 100);
  const proteinPercent = Math.round((n.protein_g * 4 / n.daily_calories) * 100);
  const fatPercent = Math.round((n.fat_g * 9 / n.daily_calories) * 100);

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Daily Fuel</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Nutrition Plan</h1>
        <p className="text-sm text-[#525252] mt-0.5">Monday, June 8 · Bike Day · Strictly Gluten-Free · Anti-Inflammatory</p>
      </div>

      {/* Celiac warning */}
      <div className="rounded-xl border border-[#d97706]/30 bg-[#d97706]/5 p-4 mb-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#fbbf24] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-[#fbbf24] mb-0.5 uppercase tracking-wider">Celiac Disease — Strict Gluten-Free Protocol</p>
          <p className="text-xs text-[#737373]">All meals, snacks, gels, and sports products must be certified gluten-free. Verify labels. Avoid shared preparation surfaces. Race-day nutrition must be pre-verified and brought from home.</p>
        </div>
      </div>

      <CoachCard
        title="Nutrition Strategy — Today"
        message="Bike training day (60min sweet spot). Prioritize complex GF carbohydrates for sustained energy. Choose lower-GI carbs for meals, but fast-absorbing GF gels during the workout are appropriate. Post-ride: protein within 30min to support RA joint recovery and Hashimoto's tissue repair."
        type="info"
        agentSource="Nutrition Agent"
        className="mb-3"
      />

      <CoachCard
        title="T1D Fueling — Sweet Spot Bike (60min)"
        message="Target pre-bike glucose: 130–160 mg/dL. Sweet spot intervals will raise intensity — watch for glucose spike from catecholamines during hard efforts. Keep GF glucose tabs ready. Consult your endo for your personal pre-exercise target. Not medical advice."
        type="warning"
        agentSource="Diabetes Agent"
        className="mb-6"
      />

      {/* Macro Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Daily Calories" value={n.daily_calories.toLocaleString()} unit="kcal" icon={Flame} subtext={`For ${p.weight_lb} lb athlete`} />
        <StatCard label="Carbohydrates" value={n.carbs_g} unit="g" subtext={`${carbPercent}% · GF sources only`} icon={Zap} />
        <StatCard label="Protein" value={n.protein_g} unit="g" subtext={`${proteinPercent}% · 1.6g/kg`} icon={Beef} highlight="success" />
        <StatCard label="Fat" value={n.fat_g} unit="g" subtext={`${fatPercent}% · Omega-3 priority`} icon={Droplets} />
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
                  <span className="text-xs text-[#60a5fa] font-black">{n.hydration_oz_per_hour} oz/hr</span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563eb] rounded-full" style={{ width: "70%" }} />
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
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full bg-[#d97706] rounded-full" style={{ width: "75%" }} />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-[#1e1e1e] space-y-1.5">
              <p className="text-[10px] text-[#fbbf24] font-bold">⚠️ Electrolyte note:</p>
              <p className="text-[11px] text-[#525252] leading-relaxed">Verify all electrolyte products are gluten-free. Many tablets/powders contain barley or wheat derivatives.</p>
            </div>
          </div>
        </div>

        {/* Workout Fueling */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Bike Fueling Plan (GF)</p>
          <div className="space-y-3">
            {[
              { phase: "Pre-workout (30min before)", carbs: "28g", notes: "GF banana + almond butter" },
              { phase: "0–20min (warm-up)", carbs: "—", notes: "Water only, let glucose stabilize" },
              { phase: "20–40min (sweet spot effort)", carbs: "20g", notes: "GF gel (verified) + water" },
              { phase: "40–60min (second interval)", carbs: "20g", notes: "GF gel + 400ml water" },
              { phase: "Post-ride (within 30min)", carbs: "55g + 35g PRO", notes: "Rice + salmon + veggies" },
            ].map((item) => (
              <div key={item.phase} className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] text-[#404040]">{item.phase}</div>
                  <div className="text-[11px] text-[#737373]">{item.notes}</div>
                </div>
                <div className="text-[10px] font-black text-[#CE0E2D] flex-shrink-0 bg-[#CE0E2D]/10 px-2 py-0.5 rounded">{item.carbs}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly carb chart */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 mb-6">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Weekly Carbohydrate Intake vs Target</p>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyCarbs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#525252" }} unit="g" axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="target" fill="#1a1a1a" radius={[3, 3, 0, 0]} name="Target" />
              <Bar dataKey="carbs" fill="#CE0E2D" radius={[3, 3, 0, 0]} name="Actual" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Meal Timeline */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">Daily Meal Timeline</p>
          <span className="text-[10px] text-[#fbbf24] bg-[#d97706]/10 border border-[#d97706]/20 px-2 py-1 rounded font-bold">All items verified GF</span>
        </div>
        <div className="space-y-0">
          {n.fueling_timeline.map((meal, i) => (
            <div key={i} className="flex gap-4 relative">
              {i < n.fueling_timeline.length - 1 && (
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

      {/* Anti-inflammatory */}
      <div className="rounded-xl border border-[#d97706]/20 bg-[#d97706]/5 p-4">
        <p className="text-[9px] font-black text-[#fbbf24] mb-3 uppercase tracking-[0.15em]">Anti-Inflammatory Priority (RA + Hashimoto&apos;s)</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { food: "Salmon / Sardines", benefit: "Omega-3 (EPA/DHA) — reduces joint inflammation" },
            { food: "Turmeric + black pepper", benefit: "Curcumin — RA and thyroid inflammation support" },
            { food: "Leafy greens (spinach)", benefit: "Antioxidants, iron for thyroid function" },
            { food: "Berries", benefit: "Polyphenols — anti-inflammatory, low-GI, great for recovery" },
          ].map((item) => (
            <div key={item.food} className="bg-[#151515] rounded-lg p-2.5 border border-[#1e1e1e]">
              <div className="text-xs font-bold text-[#fbbf24] mb-1">{item.food}</div>
              <div className="text-[10px] text-[#525252] leading-relaxed">{item.benefit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

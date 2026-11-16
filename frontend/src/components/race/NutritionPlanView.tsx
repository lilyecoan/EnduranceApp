"use client";
import { CloudSun, Droplets, ExternalLink, HeartPulse, Info, Mountain, Sunrise, Wind } from "lucide-react";
import { useUnits } from "@/components/units/UnitsProvider";
import type { NutritionPlan, Race } from "@/lib/raceApi";
import { formatClock, formatElevation, formatFluid, formatFluidPerHour, formatTemp, renderUnitTokens } from "@/lib/units";

const phaseStyle: Record<string, string> = {
  "Day before": "text-[#a78bfa] bg-[#7c3aed]/10",
  "Night before": "text-[#a78bfa] bg-[#7c3aed]/10",
  "Pre-race": "text-[#fbbf24] bg-[#d97706]/10",
  Swim: "text-[#60a5fa] bg-[#2563eb]/10",
  Bike: "text-[#fbbf24] bg-[#d97706]/10",
  Run: "text-[#f87171] bg-[#CE0E2D]/10",
  T1: "text-[#a3a3a3] bg-[#262626]",
  T2: "text-[#a3a3a3] bg-[#262626]",
  Recovery: "text-[#4ade80] bg-[#16a34a]/10",
};

const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#1e1e1e] bg-[#151515] p-3">
      <div className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.12em] mb-1">{label}</div>
      <div className="text-lg font-black text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#525252]">{sub}</div>}
    </div>
  );
}

export function NutritionPlanView({ race, plan }: { race: Race; plan: NutritionPlan }) {
  const { units } = useUnits();
  const c = plan.conditions;
  const t = (s: string) => renderUnitTokens(s, units);
  const timeLabel = (offset: number, clock: string, phase: string) =>
    offset <= -6 * 60 ? phase : formatClock(clock);

  return (
    <div className="space-y-4">
      {/* Conditions */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">Race-day conditions</p>
          {c && (
            <span className="text-[10px] text-[#737373]">
              {c.basis === "forecast" ? "Forecast" : `Typical for this date (${c.years.length} past years)`}
            </span>
          )}
        </div>
        {c ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="At start" value={c.start_temp_c != null ? formatTemp(c.start_temp_c, units) : "–"}
              sub={`${formatClock(plan.start_time)}${plan.start_time_assumed ? " (assumed)" : ""}`} />
            <Stat label="Hottest, feels like" value={c.peak_feels_like_c != null ? formatTemp(c.peak_feels_like_c, units) : "–"}
              sub={c.peak_temp_c != null ? `air ${formatTemp(c.peak_temp_c, units)}` : undefined} />
            <Stat label="Humidity" value={c.avg_humidity_pct != null ? `${Math.round(c.avg_humidity_pct)}%` : "–"}
              sub={c.rain_chance_pct != null ? `${c.rain_chance_pct}% chance of rain` : undefined} />
            <Stat label="Wind" value={c.avg_wind_kph != null ? (units === "imperial" ? `${Math.round(c.avg_wind_kph / 1.609)} mph` : `${Math.round(c.avg_wind_kph)} km/h`) : "–"}
              sub={c.sunrise ? `sunrise ${formatClock(c.sunrise)}` : undefined} />
          </div>
        ) : (
          <p className="text-xs text-[#525252]">No weather yet. Add the race location to include it.</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-[#737373]">
          {race.place_name && <span className="inline-flex items-center gap-1"><CloudSun className="w-3 h-3" /> {race.place_name}</span>}
          {race.venue_elevation_m != null && <span className="inline-flex items-center gap-1"><Mountain className="w-3 h-3" /> Venue {formatElevation(race.venue_elevation_m, units)}</span>}
          {race.elevation_gain_m != null && <span className="inline-flex items-center gap-1"><Mountain className="w-3 h-3" /> {formatElevation(race.elevation_gain_m, units)} climbing</span>}
          {race.course_info?.water_temp_c != null && <span className="inline-flex items-center gap-1"><Droplets className="w-3 h-3" /> Water {formatTemp(race.course_info.water_temp_c, units)}</span>}
          {c?.sunrise && <span className="inline-flex items-center gap-1"><Sunrise className="w-3 h-3" /> {formatClock(c.sunrise)}</span>}
          {c?.avg_wind_kph != null && c.avg_wind_kph > 25 && <span className="inline-flex items-center gap-1"><Wind className="w-3 h-3" /> Windy</span>}
        </div>
      </div>

      {/* Targets */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Race-day fueling targets</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Expected time" value={hm(plan.expected_finish_minutes)}
            sub={plan.finish_basis === "goal" ? "your goal" : plan.finish_basis === "pace" ? "from your run pace" : "typical finish"} />
          <Stat label="Carbs" value={`${plan.rates.carbs_g_per_hr} g/hr`} sub={`${plan.totals_during.carbs_g} g total`} />
          <Stat label="Fluid" value={plan.rates.fluid_ml_per_hr ? formatFluidPerHour(plan.rates.fluid_ml_per_hr, units) : "To thirst"}
            sub={plan.totals_during.fluid_ml ? `${formatFluid(plan.totals_during.fluid_ml, units)} total` : undefined} />
          <Stat label="Sodium" value={plan.rates.sodium_mg_per_hr ? `${plan.rates.sodium_mg_per_hr} mg/hr` : "–"}
            sub={plan.totals_during.caffeine_mg ? `caffeine ${plan.totals_during.caffeine_mg} mg` : "no caffeine"} />
        </div>
        {plan.legs.length > 1 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-[#a3a3a3]">
              <thead>
                <tr className="text-left text-[#525252]">
                  <th className="font-bold py-1">Leg</th><th className="font-bold">Time</th><th className="font-bold">Carbs/hr</th><th className="font-bold">Fluid/hr</th><th className="font-bold">Sodium/hr</th>
                </tr>
              </thead>
              <tbody>
                {plan.legs.map((leg) => (
                  <tr key={leg.name} className="border-t border-[#1e1e1e]">
                    <td className="py-1.5 font-bold text-white">{leg.name}</td>
                    <td>{hm(leg.duration_min)}</td>
                    <td>{leg.carbs_g_per_hr ? `${leg.carbs_g_per_hr} g` : "–"}</td>
                    <td>{leg.fluid_ml_per_hr ? formatFluidPerHour(leg.fluid_ml_per_hr, units) : "–"}</td>
                    <td>{leg.sodium_mg_per_hr ? `${leg.sodium_mg_per_hr} mg` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustments */}
      {(plan.adjustments.length > 0 || plan.health_adjustments.length > 0) && (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse className="w-4 h-4 text-[#f472b6]" />
            <h3 className="text-sm font-black text-white">Adjusted for you</h3>
          </div>
          <ul className="space-y-1.5">
            {[...plan.adjustments, ...plan.health_adjustments].map((a, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#d4d4d4]"><span className="text-[#f472b6]">•</span><span>{t(a)}</span></li>
            ))}
          </ul>
          {plan.health_sources.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {plan.health_sources.filter((s, i, all) => all.findIndex((o) => o.url === s.url) === i).map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-[#60a5fa] hover:underline inline-flex items-center gap-1">{s.name} <ExternalLink className="w-3 h-3" /></a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Race-day timeline</p>
        <ol>
          {plan.timeline.map((e, i) => (
            <li key={i} className="flex gap-3 py-2.5 border-b border-[#1e1e1e] last:border-0">
              <div className="w-20 flex-shrink-0 text-[11px] font-black text-white font-mono pt-0.5">{timeLabel(e.offset_min, e.clock, e.phase)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${phaseStyle[e.phase] ?? "text-[#a3a3a3] bg-[#262626]"}`}>{e.phase}</span>
                  <span className="text-xs font-bold text-white">{e.title}</span>
                </div>
                <p className="text-[12px] text-[#737373] leading-relaxed">{t(e.detail)}</p>
              </div>
              <div className="flex-shrink-0 text-right text-[10px] text-[#a3a3a3] space-y-0.5 min-w-[64px]">
                {e.carbs_g > 0 && <div><span className="font-black text-white">{e.carbs_g} g</span> carbs</div>}
                {e.fluid_ml > 0 && <div><span className="font-black text-white">{formatFluid(e.fluid_ml, units)}</span></div>}
                {e.sodium_mg > 0 && <div>{e.sodium_mg} mg Na</div>}
                {e.caffeine_mg > 0 && <div>{e.caffeine_mg} mg caffeine</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Assumptions & sources */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 space-y-3">
        {plan.assumptions.length > 0 && (
          <div>
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-2 inline-flex items-center gap-1"><Info className="w-3 h-3" /> Assumptions</p>
            <ul className="space-y-1 text-[11px] text-[#a3a3a3] list-disc pl-4">
              {plan.assumptions.map((a, i) => <li key={i}>{t(a)}</li>)}
            </ul>
          </div>
        )}
        <div>
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-2">Based on</p>
          <ul className="space-y-1">
            {[...plan.sources, ...(plan.weather_attribution ? [plan.weather_attribution] : [])].map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#60a5fa] hover:underline inline-flex items-center gap-1">
                  {s.name} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] text-[#404040]">
          General sports-nutrition guidance, not medical advice. Practice this plan in long training sessions before race day.
        </p>
      </div>
    </div>
  );
}

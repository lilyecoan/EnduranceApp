"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { StatTile } from "@/components/ui/StatTile";
import { TimelineItem } from "@/components/ui/TimelineItem";
import { useUnits } from "@/components/units/UnitsProvider";
import type { NutritionPlan, Race } from "@/lib/raceApi";
import { goalLabel, isMultisport } from "@/lib/raceTypes";
import { buildProgress, BUILD_WEEKS } from "@/lib/raceProgress";
import { PHASES, buildTimelineRows, rowMeta, type Phase } from "@/lib/raceTimeline";
import {
  distanceUnit,
  formatClock,
  formatElevation,
  formatFluid,
  metersToDisplayDistance,
  metersToDisplayShort,
  renderUnitTokens,
  shortDistanceUnit,
  type Units,
} from "@/lib/units";

const ML_PER_OZ = 29.5735;
const glass = "backdrop-blur-[12px] bg-black/45 border border-white/25";

export const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
const temp = (c: number, u: Units) => ({ value: String(Math.round(u === "imperial" ? (c * 9) / 5 + 32 : c)), unit: u === "imperial" ? "°F" : "°C" });
const fluidRate = (ml: number, u: Units) =>
  u === "imperial" ? { value: String(Math.round(ml / ML_PER_OZ)), unit: "oz/hr" } : { value: String(Math.round(ml)), unit: "ml/hr" };
const wind = (kph: number, u: Units) => (u === "imperial" ? { value: String(Math.round(kph / 1.609)), unit: "mph" } : { value: String(Math.round(kph)), unit: "km/h" });

function SectionHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center lg:items-end justify-between gap-3 w-full flex-wrap">
      <div className="flex flex-col gap-1.5 min-w-0">
        <h2 className="text-xl lg:text-2xl font-semibold text-fg tracking-[-0.02em]">{title}</h2>
        {sub && <p className="text-[13px] lg:text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// --- hero -----------------------------------------------------------------------

function Distances({ race }: { race: Race }) {
  const { units } = useUnits();
  const legs = [
    race.swim_distance_m != null && isMultisport(race.race_type)
      ? { label: "Swim", value: metersToDisplayShort(race.swim_distance_m, units).toLocaleString(), unit: shortDistanceUnit(units), icon: "icon-waves-white.svg", lime: false }
      : null,
    race.bike_distance_km != null && isMultisport(race.race_type)
      ? { label: "Bike", value: String(metersToDisplayDistance(race.bike_distance_km * 1000, units)), unit: distanceUnit(units), icon: "icon-bike-ink.svg", lime: true }
      : null,
    race.run_distance_km != null
      ? { label: "Run", value: String(metersToDisplayDistance(race.run_distance_km * 1000, units)), unit: distanceUnit(units), icon: "icon-run-white.svg", lime: false }
      : null,
  ].filter(Boolean) as { label: string; value: string; unit: string; icon: string; lime: boolean }[];
  if (!legs.length) return null;
  return (
    <div className={`${glass} flex items-center w-full rounded-[22px] lg:rounded-[24px] p-3.5 lg:px-[22px] lg:py-4`}>
      {legs.map((leg, i) => (
        <div key={leg.label} className="contents">
          {i > 0 && <div className="bg-white/40 h-8 lg:h-9 w-px shrink-0" />}
          <div className={`flex flex-1 min-w-0 flex-col lg:flex-row items-center lg:gap-3 gap-1 ${i > 0 ? "lg:px-5" : ""}`}>
            <span className={`hidden lg:flex rounded-full size-10 items-center justify-center shrink-0 ${leg.lime ? "bg-lime" : "bg-white/15"}`}>
              <FigmaIcon name={leg.icon} size={18} original />
            </span>
            <div className="flex flex-col items-center lg:items-start gap-0.5 text-white whitespace-nowrap">
              <span className="text-[10px] lg:text-[11px] font-medium tracking-[0.8px] uppercase">{leg.label}</span>
              <span className="flex gap-0.5 items-baseline">
                <span className="text-xl lg:text-[22px] font-semibold tracking-[-0.02em]">{leg.value}</span>
                <span className="text-xs lg:text-[13px] font-medium">{leg.unit}</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RaceHero({ race, onEdit }: { race: Race; onEdit: () => void }) {
  const date = new Date(race.race_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-[32px] h-[440px] lg:h-[480px] p-5 lg:p-7 flex-1 min-w-0">
      <Image src="/figma/race-hero.png" alt="" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 via-40% to-black/90" />
      <div className="relative flex items-center justify-between gap-2">
        <span className={`${glass} flex gap-2 items-center px-3.5 py-2 rounded-full min-w-0`}>
          <FigmaIcon name="dot-lime.svg" size={8} original />
          <span className="text-[10px] lg:text-[11px] font-semibold text-white tracking-[1.1px] uppercase truncate">
            Race day · {goalLabel(race.race_type)}
          </span>
        </span>
        <div className="flex gap-2 shrink-0">
          {race.race_url && (
            <a href={race.race_url} target="_blank" rel="noopener noreferrer" aria-label="Official race page" className={`${glass} p-[11px] lg:p-3 rounded-full`}>
              <FigmaIcon name="icon-external-white.svg" size={16} original className="lg:size-[18px]" />
            </a>
          )}
          <button onClick={onEdit} aria-label="Edit race" className={`${glass} p-[11px] lg:p-3 rounded-full hidden lg:block`}>
            <FigmaIcon name="icon-pencil-white.svg" size={18} original />
          </button>
        </div>
      </div>
      <div className="relative flex flex-col gap-3.5 lg:gap-[18px]">
        <h2 className="text-[38px] lg:text-[64px] leading-[0.97] font-semibold text-white tracking-[-0.03em] lg:tracking-[-0.04em] [overflow-wrap:anywhere]">
          {race.name}
        </h2>
        <div className="flex flex-col lg:flex-row gap-1.5 lg:gap-5 text-[13px] lg:text-sm font-medium text-white">
          <span className="flex gap-2 items-center">
            <FigmaIcon name="icon-calendar-white.svg" size={14} original className="lg:size-4" />
            {date}{race.start_time ? ` · ${formatClock(race.start_time.slice(0, 5))}` : ""}
          </span>
          {race.location && (
            <span className="flex gap-2 items-center">
              <FigmaIcon name="icon-pin-white.svg" size={14} original className="lg:size-4" />
              {race.location}
            </span>
          )}
        </div>
        <Distances race={race} />
      </div>
    </div>
  );
}

// --- countdown --------------------------------------------------------------------

export function Countdown({ days }: { days: number }) {
  const p = buildProgress(days);
  const weeks = Math.floor(days / 7);
  const ticks = Array.from({ length: BUILD_WEEKS }, (_, i) => i < (p?.week ?? 0));
  const footer = p?.started ? `Week ${p.week} of ${BUILD_WEEKS}` : `Build starts in ${p?.startsInWeeks ?? 0} wk`;
  const flag = (size: number) => (
    <span className="bg-ink rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <FigmaIcon name="icon-flag-lime.svg" size={size * 0.45} original />
    </span>
  );
  return (
    <div className="bg-lime text-ink rounded-[28px] lg:rounded-[32px] p-[22px] lg:p-7 flex flex-col gap-4 lg:justify-between lg:flex-1 w-full">
      <div className="hidden lg:flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[1.54px]">COUNTDOWN</span>
        {flag(36)}
      </div>
      <div className="flex items-center justify-between lg:flex-col lg:items-start">
        <div className="flex gap-2.5 items-baseline lg:flex-col lg:gap-0">
          <span className="text-[64px] lg:text-[112px] leading-[0.9] font-semibold tracking-[-0.05em] lg:tracking-[-0.06em]">{days}</span>
          <span className="flex flex-col lg:flex-row lg:gap-1">
            <span className="text-sm lg:text-base font-semibold lg:font-medium">days to go</span>
            <span className="text-[13px] lg:text-base font-medium"><span className="hidden lg:inline">· </span>{weeks} weeks</span>
          </span>
        </div>
        <span className="lg:hidden">{flag(40)}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-[3px] lg:gap-1" role="img" aria-label={footer}>
          {ticks.map((done, i) => (
            <span key={i} className={`h-[22px] lg:h-6 w-[9px] lg:w-1.5 rounded-[3px] bg-ink ${done ? "" : "opacity-25"}`} />
          ))}
        </div>
        <div className="flex justify-between text-xs">
          <span className="font-semibold">{footer}</span>
          <span className="font-medium">Race week →</span>
        </div>
      </div>
    </div>
  );
}

export function RaceActions({ race, onEdit }: { race: Race; onEdit: () => void }) {
  return (
    <>
      <a href="#timeline" className="hidden lg:flex bg-surface border border-stroke gap-3.5 items-center pl-2 pr-6 py-2 rounded-full w-full hover:border-lime/50">
        <span className="bg-lime rounded-full size-14 flex items-center justify-center shrink-0">
          <FigmaIcon name="icon-bike-slide.svg" size={25.2} original />
        </span>
        <span className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-[15px] font-semibold text-fg">Open race-day plan</span>
          <span className="text-xs text-muted">Jump to your race-day timeline</span>
        </span>
        <span className="text-[22px] font-bold text-lime tracking-[2.2px]" aria-hidden>›››</span>
      </a>
      <div className="hidden lg:flex gap-2.5 w-full">
        {race.race_url && (
          <a href={race.race_url} target="_blank" rel="noopener noreferrer"
            className="border border-stroke flex flex-1 gap-2 items-center justify-center px-[18px] py-3 rounded-full text-sm font-medium text-fg hover:border-muted">
            <FigmaIcon name="icon-external.svg" size={16} original /> Race page
          </a>
        )}
        <button onClick={onEdit}
          className="border border-stroke flex flex-1 gap-2 items-center justify-center px-[18px] py-3 rounded-full text-sm font-medium text-fg hover:border-muted">
          <FigmaIcon name="icon-pencil.svg" size={16} original /> Edit race
        </button>
      </div>
    </>
  );
}

// --- conditions ---------------------------------------------------------------------

export function Conditions({ race, plan }: { race: Race; plan: NutritionPlan }) {
  const { units } = useUnits();
  const c = plan.conditions;
  const day = new Date(race.race_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const sub = !c ? "Add the race location to see race-day weather."
    : c.basis === "forecast" ? "Forecast for race day"
      : `Typical for ${day} · averaged over the past ${c.years.length} years`;
  const start = c?.start_temp_c != null ? temp(c.start_temp_c, units) : null;
  const feels = c?.peak_feels_like_c != null ? temp(c.peak_feels_like_c, units) : null;
  const air = c?.peak_temp_c != null ? temp(c.peak_temp_c, units) : null;
  const w = c?.avg_wind_kph != null ? wind(c.avg_wind_kph, units) : null;
  return (
    <section className="flex flex-col gap-3.5 lg:gap-5 w-full">
      <SectionHeader title="Race-day conditions" sub={sub}>
        <div className="flex gap-2">
          {c?.sunrise && (
            <span className="border border-lime flex gap-1.5 items-center px-3 lg:px-3.5 py-[7px] lg:py-2 rounded-full text-xs lg:text-[13px] font-medium text-lime">
              <FigmaIcon name="icon-sunrise.svg" size={14} original />
              <span className="hidden lg:inline">Sunrise</span> {formatClock(c.sunrise)}
            </span>
          )}
          {race.venue_elevation_m != null && (
            <span className="hidden lg:flex border border-stroke gap-1.5 items-center px-3.5 py-2 rounded-full text-[13px] font-medium text-muted">
              <FigmaIcon name="icon-pin.svg" size={14} original />
              Venue {formatElevation(race.venue_elevation_m, units)}
            </span>
          )}
        </div>
      </SectionHeader>
      {c && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatTile label="At start" value={start?.value ?? "–"} unit={start?.unit}
            sub={`${formatClock(plan.start_time)}${plan.start_time_assumed ? " (assumed)" : " gun time"}`} />
          <StatTile label="Feels like (peak)" value={feels?.value ?? "–"} unit={feels?.unit} sub={air ? `Air ${air.value}${air.unit}` : undefined} />
          <StatTile label="Humidity" value={c.avg_humidity_pct != null ? String(Math.round(c.avg_humidity_pct)) : "–"} unit="%"
            sub={c.rain_chance_pct != null ? `${c.rain_chance_pct}% chance of rain` : undefined} />
          <StatTile label="Wind" value={w?.value ?? "–"} unit={w?.unit}
            sub={c.avg_wind_kph == null ? undefined : c.avg_wind_kph > 25 ? "Windy" : c.avg_wind_kph > 12 ? "Breezy" : "Light"} />
        </div>
      )}
    </section>
  );
}

// --- fueling ----------------------------------------------------------------------

const LEG_STYLE: Record<string, { bar: string; dot: string }> = {
  Swim: { bar: "bg-swim", dot: "dot-swim.svg" },
  T1: { bar: "bg-muted", dot: "dot-muted.svg" },
  Bike: { bar: "bg-lime", dot: "dot-lime.svg" },
  T2: { bar: "bg-muted", dot: "dot-muted.svg" },
  Run: { bar: "bg-fg", dot: "dot-text.svg" },
};

function LegBreakdown({ plan }: { plan: NutritionPlan }) {
  const { units } = useUnits();
  const rate = (g: number, ml: number, mg: number) =>
    g || ml ? `${g} g · ${formatFluid(ml, units)} · ${mg} mg /hr` : "No fuel";
  return (
    <div className="bg-surface border border-stroke rounded-[28px] p-5 lg:p-7 flex flex-col gap-4 lg:gap-[22px] flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] lg:text-lg font-semibold text-fg">Leg by leg</h3>
        <span className="text-[13px] font-medium text-muted">{hm(plan.expected_finish_minutes)}<span className="hidden lg:inline"> total</span></span>
      </div>
      <div className="flex gap-1 w-full" role="img" aria-label="Time spent in each leg">
        {plan.legs.map((leg) => (
          <span key={leg.name} className={`h-3 lg:h-3.5 rounded-[7px] ${LEG_STYLE[leg.name]?.bar ?? "bg-fg"}`}
            style={{ flexGrow: Math.max(leg.duration_min, 1), flexBasis: 0, minWidth: 6 }} />
        ))}
      </div>
      {/* Desktop table */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-medium text-muted tracking-[0.88px] uppercase">
            <th className="py-3 font-medium">Leg</th><th className="font-medium">Time</th><th className="font-medium">Carbs/hr</th>
            <th className="font-medium">Fluid/hr</th><th className="font-medium">Sodium/hr</th>
          </tr>
        </thead>
        <tbody>
          {plan.legs.map((leg) => {
            const dim = (v: number, s: string) => (v ? <span className="text-fg">{s}</span> : <span className="text-muted">–</span>);
            return (
              <tr key={leg.name} className="border-t border-stroke">
                <td className="py-3">
                  <span className="flex gap-2.5 items-center font-semibold text-fg">
                    <FigmaIcon name={LEG_STYLE[leg.name]?.dot ?? "dot-text.svg"} size={8} original /> {leg.name}
                  </span>
                </td>
                <td className="text-fg">{hm(leg.duration_min)}</td>
                <td>{dim(leg.carbs_g_per_hr, `${leg.carbs_g_per_hr} g`)}</td>
                <td>{dim(leg.fluid_ml_per_hr, formatFluid(leg.fluid_ml_per_hr, units))}</td>
                <td>{dim(leg.sodium_mg_per_hr, `${leg.sodium_mg_per_hr} mg`)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Mobile list (transitions folded into the bar only) */}
      <div className="lg:hidden flex flex-col">
        {plan.legs.filter((l) => !l.name.startsWith("T")).map((leg, i) => (
          <div key={leg.name} className={`flex gap-2.5 items-center py-3 ${i ? "border-t border-stroke" : ""}`}>
            <FigmaIcon name={LEG_STYLE[leg.name]?.dot ?? "dot-text.svg"} size={8} original />
            <div className="flex flex-1 flex-col gap-0.5 min-w-0">
              <span className="text-[15px] font-semibold text-fg">{leg.name}</span>
              <span className="text-xs text-muted">{rate(leg.carbs_g_per_hr, leg.fluid_ml_per_hr, leg.sodium_mg_per_hr)}</span>
            </div>
            <span className="text-sm font-medium text-fg">{hm(leg.duration_min)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Short headings for the plan's standard adjustment notes (Figma: "High humidity", "Gut training").
const NOTE_TITLES: [RegExp, string][] = [
  [/humidity/i, "High humidity"],
  [/very hot/i, "Heat"],
  [/warm race/i, "Warm conditions"],
  [/cool conditions/i, "Cool conditions"],
  [/altitude/i, "Altitude"],
  [/hilly|climbing/i, "Hilly course"],
  [/g carbs per hour|g\/h/i, "Gut training"],
  [/caffeine is left out/i, "Caffeine"],
];

function splitNote(text: string): { title: string; body: string } {
  const known = NOTE_TITLES.find(([re]) => re.test(text));
  if (known && !/^T1D:/.test(text)) return { title: known[1], body: text };
  const idx = text.indexOf(": ");
  if (idx > 0 && idx < 70) {
    const title = text.slice(0, idx).replace(/\s*\(.*\)$/, "");
    return { title, body: text.slice(idx + 2).replace(/^./, (c) => c.toUpperCase()) };
  }
  const first = text.split(/(?<=[.!?])\s/)[0];
  const words = first.split(" ").slice(0, 3).join(" ").replace(/[.,;]$/, "");
  return { title: words, body: text };
}

function AdjustedForYou({ plan }: { plan: NutritionPlan }) {
  const { units } = useUnits();
  const notes = [...plan.adjustments, ...plan.health_adjustments, ...plan.assumptions.filter((a) => a.includes("g/h") || a.includes("carbs per hour"))]
    .map((n) => splitNote(renderUnitTokens(n, units)));
  return (
    <div className="bg-surface2 rounded-[28px] p-5 lg:p-7 flex flex-col gap-3 lg:gap-[18px] lg:w-[380px] lg:shrink-0">
      <div className="flex gap-2.5 items-center">
        <span className="bg-lime rounded-full size-8 lg:size-9 flex items-center justify-center">
          <FigmaIcon name="icon-sparkle-ink.svg" size={16.2} original />
        </span>
        <h3 className="text-[17px] lg:text-lg font-semibold text-fg">Adjusted for you</h3>
      </div>
      {notes.length === 0 && <p className="text-[13px] text-muted">No special adjustments for this race.</p>}
      {notes.map((n, i) => (
        <div key={i} className="bg-surface rounded-[18px] p-3.5 lg:p-4 flex flex-col gap-1 lg:gap-1.5">
          <p className="text-[13px] lg:text-sm font-semibold text-lime">{n.title}</p>
          <p className="text-[13px] leading-[1.5] text-muted">{n.body}</p>
        </div>
      ))}
      {plan.health_sources.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {plan.health_sources.filter((s, i, all) => all.findIndex((o) => o.url === s.url) === i).map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted underline hover:text-fg">{s.name}</a>
          ))}
        </div>
      )}
      <Link href="/profile" className="border border-stroke rounded-[18px] p-3.5 lg:p-4 flex gap-3 items-center hover:border-muted">
        <FigmaIcon name="icon-lock.svg" size={18} original />
        <span className="flex flex-1 flex-col gap-0.5 min-w-0">
          <span className="text-[13px] lg:text-sm font-semibold text-fg">Personal health notes</span>
          <span className="hidden lg:block text-xs text-muted">From your athlete profile · private</span>
        </span>
        <span className="text-[13px] font-semibold text-lime">View →</span>
      </Link>
    </div>
  );
}

export function Fueling({ plan, onRebuild, building }: { plan: NutritionPlan; onRebuild: () => void; building: boolean }) {
  const { units } = useUnits();
  const fluid = plan.rates.fluid_ml_per_hr ? fluidRate(plan.rates.fluid_ml_per_hr, units) : { value: "–", unit: "" };
  const basis = plan.finish_basis === "goal" ? "Your goal" : plan.finish_basis === "pace" ? "From your run pace" : "Typical finish";
  const h = Math.floor(plan.expected_finish_minutes / 60);
  const m = String(plan.expected_finish_minutes % 60).padStart(2, "0");
  return (
    <section className="flex flex-col gap-3.5 lg:gap-5 w-full">
      <SectionHeader title="Race-day fueling targets" sub={`Built around your ${hm(plan.expected_finish_minutes)} ${plan.finish_basis === "goal" ? "goal" : "expected"} time`}>
        <button onClick={onRebuild} disabled={building} aria-label="Rebuild plan"
          className="bg-surface lg:bg-transparent lg:border lg:border-stroke flex gap-2 items-center justify-center size-9 lg:size-auto lg:px-[18px] lg:py-3 rounded-full text-sm font-medium text-fg hover:border-muted disabled:opacity-50">
          <FigmaIcon name="icon-refresh.svg" size={16} original className={building ? "animate-spin" : ""} />
          <span className="hidden lg:inline">{building ? "Rebuilding…" : "Rebuild plan"}</span>
        </button>
      </SectionHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile label="Carbs" value={String(plan.rates.carbs_g_per_hr)} unit="g/hr" sub={`${plan.totals_during.carbs_g} g total`} accent className="order-1 lg:order-2" />
        <StatTile label="Expected time" value={`${h}h ${m}`} unit="m" sub={basis} className="order-2 lg:order-1" />
        <StatTile label="Fluid" value={fluid.value} unit={fluid.unit}
          sub={plan.totals_during.fluid_ml ? `${formatFluid(plan.totals_during.fluid_ml, units)} total` : "Drink to thirst"} className="order-3" />
        <StatTile label="Sodium" value={plan.rates.sodium_mg_per_hr ? String(plan.rates.sodium_mg_per_hr) : "–"} unit="mg/hr"
          sub={plan.totals_during.caffeine_mg ? `Caffeine ${plan.totals_during.caffeine_mg} mg` : "No caffeine"} className="order-4" />
      </div>
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 items-stretch">
        <LegBreakdown plan={plan} />
        <AdjustedForYou plan={plan} />
      </div>
    </section>
  );
}

// --- timeline -----------------------------------------------------------------------

export function RaceTimeline({ plan }: { plan: NutritionPlan }) {
  const { units } = useUnits();
  const [tab, setTab] = useState<"all" | Phase>("all");
  const rows = buildTimelineRows(plan.timeline, units);
  const phases = PHASES.filter((p) => rows.some((r) => r.phase === p.id)).map((p) =>
    p.id === "swimbike" && !isMultisport(plan.race_type) ? { ...p, label: "Race", short: "Race" } : p,
  );
  const shown = tab === "all" ? phases : phases.filter((p) => p.id === tab);
  const mobileRows = tab === "all" ? rows : rows.filter((r) => r.phase === tab);
  const tabBtn = (id: "all" | Phase, label: string, extra = "") => (
    <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
      className={`py-[9px] rounded-full text-[13px] ${extra} ${tab === id ? "bg-lime text-ink font-semibold" : "text-muted font-medium hover:text-fg"}`}>
      {label}
    </button>
  );
  return (
    <section id="timeline" className="flex flex-col gap-3.5 lg:gap-5 w-full scroll-mt-6">
      <SectionHeader title="Race-day timeline" sub="Every gel, bottle and coffee, timed to the minute">
        <div className="hidden lg:flex bg-surface gap-1 p-1 rounded-full">
          {tabBtn("all", "All", "px-4")}
          {phases.map((p) => tabBtn(p.id, p.label, "px-4"))}
        </div>
        {tab !== "all" && (
          <button onClick={() => setTab("all")} className="lg:hidden text-[13px] font-semibold text-lime">See all</button>
        )}
      </SectionHeader>
      <div className="lg:hidden flex bg-surface gap-1 p-1 rounded-full w-full">
        {tabBtn("all", "All", "flex-1")}
        {phases.map((p) => tabBtn(p.id, p.short, "flex-1"))}
      </div>

      {/* Mobile: one list */}
      <div className="lg:hidden bg-surface border border-stroke rounded-[28px] pt-5 pb-1 px-5">
        {mobileRows.map((r, i) => (
          <TimelineItem key={`${r.startOffset}-${r.title}`} meta={rowMeta(r)} title={r.title} detail={r.detail} amount={r.amount} last={i === mobileRows.length - 1} />
        ))}
      </div>

      {/* Desktop: one column per phase */}
      <div className="hidden lg:grid gap-4" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((p) => {
          const mine = rows.filter((r) => r.phase === p.id);
          const range = mine.length > 1 ? `${mine[0].when.split(" → ")[0]} → ${mine[mine.length - 1].when.split(" → ").pop()}` : mine[0]?.when;
          return (
            <div key={p.id} className="bg-surface border border-stroke rounded-[28px] p-[22px] flex flex-col gap-5">
              <div className="flex gap-3 items-center">
                <span className="bg-surface2 rounded-full size-10 flex items-center justify-center shrink-0">
                  <FigmaIcon name={p.icon} size={18} original />
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-base font-semibold text-fg">{p.label}</span>
                  <span className="text-xs text-muted truncate">{range}</span>
                </div>
              </div>
              <div className="flex flex-col">
                {mine.map((r, i) => (
                  <TimelineItem key={`${r.startOffset}-${r.title}`}
                    meta={p.id === "swimbike" && r.stage !== r.when ? `${r.when} · ${r.stage}` : r.when}
                    title={r.title} detail={r.detail} amount={r.amount} last={i === mine.length - 1} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- pacing & sources ------------------------------------------------------------------

export function PacingLocked({ raceDate, days }: { raceDate: string; days: number }) {
  const unlock = new Date(raceDate + "T12:00:00");
  unlock.setDate(unlock.getDate() - 56);
  const until = Math.max(0, days - 56);
  const when = unlock.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="bg-surface border border-stroke rounded-[28px] p-[18px] lg:p-6 flex gap-3.5 lg:gap-[18px] items-center flex-1 min-w-0">
      <span className="bg-surface2 rounded-full size-11 lg:size-[52px] flex items-center justify-center shrink-0">
        <FigmaIcon name="icon-lock-lg.svg" size={23.4} original />
      </span>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="text-[15px] lg:text-[17px] font-semibold text-fg">
          <span className="lg:hidden">Pacing unlocks {unlock.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span className="hidden lg:inline">Pacing targets unlock 8 weeks out</span>
        </p>
        <p className="text-xs lg:text-[13px] text-muted">
          <span className="lg:hidden">8 weeks out · focus on base training</span>
          <span className="hidden lg:inline">Focus on base training until {when}.</span>
        </p>
      </div>
      <span className="hidden lg:block bg-lime px-4 py-2.5 rounded-full text-[13px] font-semibold text-ink shrink-0">{until} days to unlock</span>
    </div>
  );
}

export function Sources({ plan }: { plan: NutritionPlan }) {
  const links = [...plan.sources, ...(plan.weather_attribution ? [plan.weather_attribution] : [])];
  return (
    <div className="lg:border lg:border-stroke rounded-[28px] lg:p-6 flex flex-col gap-2 lg:w-[420px] lg:shrink-0">
      <div className="hidden lg:flex gap-2 items-center">
        <FigmaIcon name="icon-book.svg" size={16} original />
        <span className="text-[13px] font-semibold text-muted tracking-[0.78px] uppercase">Based on</span>
      </div>
      <p className="hidden lg:block text-[13px] leading-[1.5] text-fg">
        {links.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-lime underline-offset-2 hover:underline">{s.name}</a>
          </span>
        ))}
      </p>
      <p className="text-[11px] lg:text-xs leading-[1.5] text-muted">
        General sports-nutrition guidance, not medical advice. Practise this plan in long sessions first.
        <span className="lg:hidden"> Based on ACSM, ISSN &amp; Jeukendrup (2014). Weather by Open-Meteo.</span>
      </p>
    </div>
  );
}

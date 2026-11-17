import type { TimelineEntry } from "@/lib/raceApi";
import { formatClock, formatFluid, renderUnitTokens, type Units } from "@/lib/units";

export type Phase = "pre" | "swimbike" | "run" | "recovery";

export const PHASES: { id: Phase; label: string; short: string; icon: string }[] = [
  { id: "pre", label: "Pre-race", short: "Pre", icon: "icon-moon.svg" },
  { id: "swimbike", label: "Swim + Bike", short: "Bike", icon: "icon-bike.svg" },
  { id: "run", label: "Run", short: "Run", icon: "icon-run.svg" },
  { id: "recovery", label: "Recovery", short: "Post", icon: "icon-heart-phase.svg" },
];

const PHASE_OF: Record<string, Phase> = {
  "Day before": "pre", "Night before": "pre", "Pre-race": "pre",
  Swim: "swimbike", T1: "swimbike", Bike: "swimbike", T2: "swimbike",
  Run: "run", Recovery: "recovery",
};

export type TimelineRow = {
  phase: Phase;
  /** Clock or phase label, e.g. "4:00 AM" or "Day before"; ranges for grouped fuel stops. */
  when: string;
  stage: string;
  title: string;
  detail: string;
  amount: string | null;
  startOffset: number;
  endOffset: number;
};

const isDayLabel = (e: TimelineEntry) => e.offset_min <= -6 * 60;

function amountText(carbs: number, fluidMl: number, sodium: number, caffeine: number, u: Units): string | null {
  const parts: string[] = [];
  if (carbs) parts.push(sodium ? `${carbs} g` : `${carbs} g carbs`);
  if (fluidMl) parts.push(formatFluid(fluidMl, u));
  if (sodium) parts.push(`${sodium} mg Na`);
  if (caffeine) parts.push(`${caffeine} mg caffeine`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Plan timeline -> display rows. Repeated fuel stops in a leg (e.g. six "Bike
 * fuel" entries) collapse into one "Bike fuel ×6" row at the first stop, even
 * when a one-off item such as late caffeine falls between them.
 */
export function buildTimelineRows(entries: TimelineEntry[], u: Units): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const used = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;
    const e = entries[i];
    const group = [i];
    if (/ fuel$/i.test(e.title)) {
      entries.forEach((o, k) => {
        if (k > i && o.title === e.title && o.phase === e.phase) group.push(k);
      });
    }
    group.forEach((k) => used.add(k));
    const count = group.length;
    const last = entries[group[group.length - 1]];
    const every = count > 1 ? Math.round(entries[group[1]].offset_min - e.offset_min) : 0;
    const detail = renderUnitTokens(e.detail, u);
    rows.push({
      phase: PHASE_OF[e.phase] ?? "pre",
      when: isDayLabel(e)
        ? e.phase
        : count > 1
          ? `${formatClock(e.clock)} → ${formatClock(last.clock)}`
          : formatClock(e.clock),
      stage: e.phase,
      title: count > 1 ? `${e.title} ×${count}` : e.title,
      detail: count > 1 && every > 0 ? `Every ${every} min: ${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : detail,
      amount: amountText(e.carbs_g, e.fluid_ml, e.sodium_mg, e.caffeine_mg, u),
      startOffset: e.offset_min,
      endOffset: last.offset_min,
    });
  }
  return rows;
}

/** "4:00 AM · Pre-race" style meta line for the single-list (mobile) view. */
export const rowMeta = (r: TimelineRow) => (r.when === r.stage ? r.when : `${r.when} · ${r.stage}`);

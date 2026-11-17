"use client";
import { daysUntil, weeksUntil } from "@/lib/utils";

interface RaceCountdownProps {
  raceDate: string;
  raceName: string;
}

export function RaceCountdown({ raceDate, raceName }: RaceCountdownProps) {
  const days = daysUntil(raceDate);
  const weeks = weeksUntil(raceDate);

  let phase = "BASE";
  let phaseColor = "text-ink";
  let phaseBg = "bg-ink/10";
  if (weeks <= 0)  { phase = "RACE DAY"; phaseColor = "text-lime"; phaseBg = "bg-ink"; }
  else if (weeks <= 2)  { phase = "TAPER"; phaseColor = "text-[#fbbf24]"; phaseBg = "bg-[#d97706]/10"; }
  else if (weeks <= 6)  { phase = "PEAK"; phaseColor = "text-[#f87171]"; phaseBg = "bg-[#f87171]/10"; }
  else if (weeks <= 14) { phase = "BUILD"; phaseColor = "text-[#4ade80]"; phaseBg = "bg-[#16a34a]/10"; }

  const pct = Math.max(2, Math.min(98, 100 - (days / 285) * 100));

  return (
    <div className="rounded-[24px] border border-stroke bg-surface overflow-hidden">
      {/* Lime top bar */}
      <div className="bg-lime px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink">Next Race</span>
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded ${phaseColor} ${phaseBg}`}>
          {phase}
        </span>
      </div>

      <div className="p-4">
        <div className="text-sm font-bold text-white leading-tight">{raceName}</div>
        <div className="text-[10px] text-muted mt-0.5">
          {new Date(raceDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>

        <div className="flex items-end gap-2 mt-4">
          <span className="text-5xl font-semibold text-white tabular-nums leading-none">{days}</span>
          <div className="mb-1">
            <div className="text-xs text-muted font-bold uppercase tracking-widest leading-none">days</div>
            <div className="text-xs text-muted leading-none mt-0.5">{weeks} weeks</div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-[9px] text-muted/70 uppercase tracking-wider mb-1.5">
            <span>Start</span>
            <span>Finish Line 🏁</span>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="text-[9px] text-muted/70 font-bold uppercase tracking-[0.15em] mt-3 text-center">
          Anything is Possible®
        </p>
      </div>
    </div>
  );
}

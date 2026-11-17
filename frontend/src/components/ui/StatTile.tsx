type Props = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  /** Lime highlight tile (Figma: Carbs). */
  accent?: boolean;
  className?: string;
};

/** Figma "Stat Tile": big-number stat with label, value, unit and a sub line. */
export function StatTile({ label, value, unit, sub, accent = false, className = "" }: Props) {
  return (
    <div
      className={`flex flex-col gap-[14px] p-5 rounded-[24px] min-w-0 ${
        accent ? "bg-lime text-ink" : "bg-surface border border-stroke"
      } ${className}`}
    >
      <p className={`text-[11px] font-medium tracking-[1.1px] uppercase ${accent ? "" : "text-muted"}`}>{label}</p>
      <div className="flex gap-1 items-baseline whitespace-nowrap overflow-hidden">
        <span className={`text-[40px] leading-none font-semibold tracking-[-1.6px] ${accent ? "" : "text-fg"}`}>{value}</span>
        {unit && <span className={`text-base font-medium ${accent ? "" : "text-muted"}`}>{unit}</span>}
      </div>
      {sub && <p className={`text-[13px] ${accent ? "" : "text-muted"}`}>{sub}</p>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayLoad, WeekAdjustment } from "@/lib/weekPlan";

// Validated (dark surface #111): planned vs. done. Upcoming days reuse the
// "done" hue as an outline, so state is shown by fill, not a third color.
const PLANNED = "#6b7fd7";
const DONE = "#e5484d";

type Row = DayLoad & { you: number | null; upcoming: boolean };

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#262626] bg-[#0d0d0d] px-3 py-2 text-[11px] shadow-lg">
      <div className="font-black text-white mb-1">{r.day}</div>
      <div className="text-[#a3a3a3]">Planned: <span className="text-white font-bold">{r.planned}</span></div>
      {r.done !== null && <div className="text-[#a3a3a3]">Done: <span className="text-white font-bold">{r.done}</span></div>}
      {r.adjusted !== null && r.adjusted !== r.planned && (
        <div className="text-[#a3a3a3]">Adjusted plan: <span className="text-white font-bold">{r.adjusted}</span></div>
      )}
    </div>
  );
}

function Swatch({ color, hollow = false }: { color: string; hollow?: boolean }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-[3px]"
      style={hollow ? { border: `1.5px dashed ${color}` } : { background: color }}
    />
  );
}

/** Planned vs. actual training load for each day of this week. */
export function LoadChart({ week, todayIso }: { week: WeekAdjustment; todayIso: string }) {
  const [showTable, setShowTable] = useState(false);
  const rows: Row[] = week.days.map((d) => {
    const upcoming = d.done === null && d.date >= todayIso && d.adjusted !== null;
    return { ...d, upcoming, you: d.done ?? (upcoming ? d.adjusted : null) };
  });
  const pct = Math.round((week.factor - 1) * 100);

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em]">This week&apos;s load</p>
        {pct !== 0 && (
          <span className="text-[10px] font-bold text-white bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded">
            Rest of week {pct > 0 ? "+" : ""}{pct}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-black text-white tabular-nums">{week.doneTotal}</span>
        <span className="text-xs text-[#737373]">of {week.plannedTotal} planned</span>
        {week.delta !== 0 && (
          <span className="text-xs font-bold text-[#d4d4d4]">({week.delta > 0 ? "+" : ""}{week.delta} vs plan so far)</span>
        )}
      </div>
      <p className="text-[11px] text-[#a3a3a3] mb-3">{week.message}</p>

      <div className="h-44" role="img" aria-label="Bar chart of planned versus completed training load by day">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="#1e1e1e" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#737373", fontSize: 10 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#525252", fontSize: 10 }} width={48} />
            <Tooltip content={<TooltipBody />} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="planned" name="Planned" fill={PLANNED} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar
              dataKey="you"
              name="Done / adjusted"
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              shape={(props: unknown) => {
                const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: Row };
                if (!height || height <= 0) return <g />;
                return payload.upcoming ? (
                  <rect x={x + 0.75} y={y + 0.75} width={Math.max(0, width - 1.5)} height={Math.max(0, height - 0.75)} rx={3}
                    fill="transparent" stroke={DONE} strokeWidth={1.5} strokeDasharray="3 2" />
                ) : (
                  <path d={`M${x},${y + height} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + width - 4} Q${x + width},${y} ${x + width},${y + 4} V${y + height} Z`} fill={DONE} />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-[#a3a3a3]">
        <span className="inline-flex items-center gap-1.5"><Swatch color={PLANNED} /> Planned</span>
        <span className="inline-flex items-center gap-1.5"><Swatch color={DONE} /> Done (logged)</span>
        <span className="inline-flex items-center gap-1.5"><Swatch color={DONE} hollow /> Adjusted plan</span>
        <button className="ml-auto text-[#737373] hover:text-white font-bold" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Hide table" : "Table"}
        </button>
      </div>

      {showTable && (
        <table className="w-full mt-2 text-[11px] text-[#a3a3a3]">
          <thead>
            <tr className="text-[#525252] text-left">
              <th className="font-bold py-1">Day</th><th className="font-bold">Planned</th><th className="font-bold">Done</th><th className="font-bold">Adjusted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-[#1e1e1e]">
                <td className="py-1 text-white font-bold">{r.day}</td>
                <td>{r.planned}</td>
                <td>{r.done ?? "–"}</td>
                <td>{r.adjusted ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {week.warnings.map((w, i) => (
        <p key={i} className="mt-2 text-[11px] text-[#fbbf24]">⚠ {w}</p>
      ))}
      <p className="mt-2 text-[9px] text-[#404040]">
        Load ≈ TSS: hours × intensity² × 100, with intensity from your effort rating, or the plan scaled by how much you did.
      </p>
    </div>
  );
}

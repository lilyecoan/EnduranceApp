"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fetchWellnessHistory, type HistoryDay } from "@/lib/wellnessApi";

// Validated on the dark surface (see LoadChart): two-series pair + lime for single series.
const LIME = "#d4f54c";
const BLUE = "#6b7fd7";
const RED = "#e5484d";

const axis = { tick: { fontSize: 10, fill: "#8b8b92" }, axisLine: false, tickLine: false } as const;

type TipProps = { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string };

function Tip({ active, payload, label, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg border border-stroke rounded-lg px-3 py-2 text-[11px]">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-fg font-semibold">
          <span className="inline-block size-2 rounded-full mr-1.5" style={{ background: p.color }} />
          {p.name}: {p.value}{unit ?? ""}
        </p>
      ))}
    </div>
  );
}

function Card({ title, sub, empty, children }: { title: string; sub?: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-stroke bg-surface p-5">
      <div className="flex items-baseline justify-between mb-4 gap-2">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {sub && <p className="text-[11px] text-muted">{sub}</p>}
      </div>
      <div className="h-[200px]">
        {empty ? <div className="h-full grid place-items-center text-xs text-muted">No data in the last 30 days yet</div> : children}
      </div>
    </div>
  );
}

const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Your real daily history: HRV, resting HR, sleep and fitness/fatigue. */
export function HistoryCharts() {
  const { getToken, isSignedIn } = useAuth();
  const [days, setDays] = useState<(HistoryDay & { label: string })[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchWellnessHistory(await getToken(), 30);
        if (!cancelled) setDays(rows.map((r) => ({ ...r, label: shortDate(r.date) })));
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  if (error) return <p className="text-sm text-muted">Couldn&apos;t load your history.</p>;
  if (!days) return <p className="text-sm text-muted">Loading your history…</p>;

  const has = (k: keyof HistoryDay) => days.some((d) => d[k] != null);
  // Apple Health reports SDNN, a different HRV statistic; never mix the two.
  const sdnnOnly = !has("hrv_rmssd") && has("hrv_sdnn");
  const hrvKey = sdnnOnly ? "hrv_sdnn" : "hrv_rmssd";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="HRV" sub={sdnnOnly ? "SDNN (Apple Health), ms" : "Overnight rMSSD, ms"} empty={!has(hrvKey)}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ left: -20, right: 4 }}>
            <defs>
              <linearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={LIME} stopOpacity={0.25} />
                <stop offset="95%" stopColor={LIME} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#2a2b30" />
            <XAxis dataKey="label" {...axis} minTickGap={24} />
            <YAxis {...axis} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip content={<Tip unit=" ms" />} />
            <Area type="monotone" dataKey={hrvKey} name="HRV" stroke={LIME} strokeWidth={2} fill="url(#hrvFill)" connectNulls dot={{ r: 3, fill: LIME }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Resting heart rate" sub="bpm" empty={!has("resting_hr")}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ left: -20, right: 4 }}>
            <CartesianGrid vertical={false} stroke="#2a2b30" />
            <XAxis dataKey="label" {...axis} minTickGap={24} />
            <YAxis {...axis} domain={["dataMin - 3", "dataMax + 3"]} />
            <Tooltip content={<Tip unit=" bpm" />} />
            <Line type="monotone" dataKey="resting_hr" name="Resting HR" stroke={LIME} strokeWidth={2} connectNulls dot={{ r: 3, fill: LIME }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Sleep" sub="hours per night" empty={!has("sleep_hours")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ left: -20, right: 4 }}>
            <CartesianGrid vertical={false} stroke="#2a2b30" />
            <XAxis dataKey="label" {...axis} minTickGap={24} />
            <YAxis {...axis} domain={[0, 10]} />
            <Tooltip content={<Tip unit=" h" />} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="sleep_hours" name="Sleep" fill={LIME} radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Fitness & fatigue" sub="CTL vs ATL" empty={!has("ctl")}>
        <div className="h-[176px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ left: -20, right: 4 }}>
              <CartesianGrid vertical={false} stroke="#2a2b30" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="ctl" name="Fitness (CTL)" stroke={BLUE} strokeWidth={2} connectNulls dot={false} />
              <Line type="monotone" dataKey="atl" name="Fatigue (ATL)" stroke={RED} strokeWidth={2} connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: BLUE }} /> Fitness (CTL)</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: RED }} /> Fatigue (ATL)</span>
        </div>
      </Card>
    </div>
  );
}

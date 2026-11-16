"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, NotebookPen, Trash2 } from "lucide-react";
import { useUnits } from "@/components/units/UnitsProvider";
import { deleteLog, saveLog, type WorkoutLog } from "@/lib/trainingApi";
import {
  displayDistanceToMeters,
  displayShortToMeters,
  distanceUnit,
  formatDistance,
  formatShortDistance,
  metersToDisplayDistance,
  metersToDisplayShort,
  shortDistanceUnit,
} from "@/lib/units";
import type { Session } from "@/lib/weekPlan";

const RPE_LABELS: Record<number, string> = {
  1: "Very easy", 2: "Easy", 3: "Easy", 4: "Comfortable", 5: "Steady",
  6: "Moderate", 7: "Hard", 8: "Very hard", 9: "Near max", 10: "All out",
};

const inputCls =
  "w-full text-sm bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-white placeholder:text-[#404040] focus:outline-none focus:border-[#404040]";

type Props = {
  sessions: Session[];
  logs: WorkoutLog[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onChanged: (log: WorkoutLog | null, removedId?: string) => void;
  todayIso: string;
};

const EXTRA_KEY = "extra";

type Form = { status: "completed" | "skipped"; duration: string; distance: string; rpe: number | null; hr: string; notes: string; sport: string };

function formFor(log: WorkoutLog | undefined, session: Session | undefined, units: "imperial" | "metric"): Form {
  const swim = (log?.sport ?? session?.sport) === "Swim";
  const dist = log?.actual_distance_m;
  return {
    status: log?.status ?? "completed",
    duration: log?.actual_duration_min != null ? String(Math.round(log.actual_duration_min)) : "",
    distance: dist != null ? String(swim ? metersToDisplayShort(dist, units) : metersToDisplayDistance(dist, units)) : "",
    rpe: log?.rpe ?? null,
    hr: log?.avg_hr != null ? String(log.avg_hr) : "",
    notes: log?.notes ?? "",
    sport: log?.sport ?? "Run",
  };
}

/** Where the athlete records what they actually did, how it felt, and notes. */
export function WorkoutLogPanel({ sessions, logs, selectedKey, onSelect, onChanged, todayIso }: Props) {
  const { getToken } = useAuth();
  const { units } = useUnits();
  const isExtra = selectedKey === EXTRA_KEY;
  const session = sessions.find((s) => s.key === selectedKey);
  const existing = isExtra ? undefined : logs.find((l) => `${l.date}:${l.slot}` === selectedKey);
  const [extraDate, setExtraDate] = useState(todayIso);
  const [form, setForm] = useState<Form>(() => formFor(existing, session, units));
  const [formFor_, setFormFor] = useState(selectedKey + (existing?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Reset the form when a different session (or its saved log) is selected.
  const formKey = selectedKey + (existing?.id ?? "");
  if (formKey !== formFor_) {
    setFormFor(formKey);
    setForm(formFor(existing, session, units));
    setStatus(null);
  }

  const sport = isExtra ? form.sport : session?.sport ?? "Run";
  const swim = sport === "Swim";
  const showDistance = sport !== "Strength";

  async function save() {
    setSaving(true);
    setStatus(null);
    const distance = form.distance ? Number(form.distance) : null;
    try {
      const saved = await saveLog(await getToken(), {
        date: isExtra ? extraDate : session!.date,
        slot: isExtra ? "extra" : session!.slot,
        sport,
        planned_name: isExtra ? "Unplanned workout" : session!.name,
        planned_duration_min: isExtra ? null : session!.duration_min,
        planned_distance_m: isExtra ? null : session!.distance_m,
        planned_load: isExtra ? null : session!.load,
        status: form.status,
        actual_duration_min: form.status === "skipped" || !form.duration ? null : Number(form.duration),
        actual_distance_m: form.status === "skipped" || distance === null ? null
          : swim ? displayShortToMeters(distance, units) : displayDistanceToMeters(distance, units),
        rpe: form.status === "skipped" ? null : form.rpe,
        avg_hr: form.status === "skipped" || !form.hr ? null : Number(form.hr),
        notes: form.notes || null,
      });
      onChanged(saved);
      setStatus({ ok: true, text: `Saved · load ${saved.load}${saved.planned_load ? ` (planned ${saved.planned_load})` : ""}` });
    } catch {
      setStatus({ ok: false, text: "Couldn't save. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteLog(await getToken(), existing.id);
      onChanged(null, existing.id);
      setStatus({ ok: true, text: "Log removed" });
    } catch {
      setStatus({ ok: false, text: "Couldn't remove the log." });
    } finally {
      setSaving(false);
    }
  }

  const loggable = sessions.filter((s) => s.date <= todayIso);

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
      <div className="flex items-center gap-2 mb-3">
        <NotebookPen className="w-4 h-4 text-[#60a5fa]" />
        <h3 className="text-sm font-black text-white">Log a workout</h3>
      </div>

      <label className="block text-[11px] font-bold text-[#737373] space-y-1 mb-3">
        <span>Session</span>
        <select className={inputCls} value={selectedKey} onChange={(e) => onSelect(e.target.value)}>
          {loggable.map((s) => {
            const logged = logs.some((l) => `${l.date}:${l.slot}` === s.key);
            return (
              <option key={s.key} value={s.key}>
                {logged ? "✓ " : ""}{s.day} · {s.name}
              </option>
            );
          })}
          <option value={EXTRA_KEY}>+ Unplanned workout</option>
        </select>
      </label>

      {session && !isExtra && (
        <p className="text-[11px] text-[#525252] mb-3">
          Planned: {session.duration_min} min
          {session.distance_m ? ` · ${swim ? formatShortDistance(session.distance_m, units) : formatDistance(session.distance_m, units)}` : ""}
          {` · load ${session.load}`}
        </p>
      )}

      {isExtra && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="text-[11px] font-bold text-[#737373] space-y-1">
            <span>Date</span>
            <input type="date" className={inputCls} value={extraDate} max={todayIso} onChange={(e) => setExtraDate(e.target.value)} />
          </label>
          <label className="text-[11px] font-bold text-[#737373] space-y-1">
            <span>Sport</span>
            <select className={inputCls} value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
              {["Swim", "Bike", "Run", "Strength", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="inline-flex p-0.5 rounded-lg border border-[#262626] bg-[#0d0d0d] mb-3">
        {(["completed", "skipped"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={form.status === s} onClick={() => setForm({ ...form, status: s })}
            className={`px-3 py-1 text-[11px] font-bold rounded-md ${form.status === s ? "bg-[#CE0E2D] text-white" : "text-[#737373] hover:text-white"}`}>
            {s === "completed" ? "Did it" : "Skipped"}
          </button>
        ))}
      </div>

      {form.status === "completed" && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="text-[11px] font-bold text-[#737373] space-y-1">
              <span>Time (min)</span>
              <input className={inputCls} type="number" min={0} max={1440} inputMode="numeric" value={form.duration}
                placeholder={session ? String(session.duration_min) : ""} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </label>
            {showDistance && (
              <label className="text-[11px] font-bold text-[#737373] space-y-1">
                <span>Distance ({swim ? shortDistanceUnit(units) : distanceUnit(units)})</span>
                <input className={inputCls} type="number" min={0} step={swim ? 25 : 0.1} inputMode="decimal" value={form.distance}
                  placeholder={session?.distance_m ? String(swim ? metersToDisplayShort(session.distance_m, units) : metersToDisplayDistance(session.distance_m, units)) : ""}
                  onChange={(e) => setForm({ ...form, distance: e.target.value })} />
              </label>
            )}
            <label className="text-[11px] font-bold text-[#737373] space-y-1">
              <span>Avg HR</span>
              <input className={inputCls} type="number" min={30} max={250} inputMode="numeric" value={form.hr}
                onChange={(e) => setForm({ ...form, hr: e.target.value })} />
            </label>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[11px] font-bold text-[#737373] mb-1">
              <span>How hard did it feel?</span>
              <span className="text-white">{form.rpe ? `${form.rpe}/10 · ${RPE_LABELS[form.rpe]}` : "Not rated"}</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" aria-label={`Effort ${n}: ${RPE_LABELS[n]}`} aria-pressed={form.rpe === n}
                  onClick={() => setForm({ ...form, rpe: form.rpe === n ? null : n })}
                  className={`h-7 rounded text-[11px] font-bold ${form.rpe === n ? "bg-[#CE0E2D] text-white" : "bg-[#1a1a1a] text-[#737373] hover:text-white"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <label className="block text-[11px] font-bold text-[#737373] space-y-1 mb-3">
        <span>Notes</span>
        <textarea className={`${inputCls} min-h-[72px] resize-y`} maxLength={2000} value={form.notes}
          placeholder="How it went: legs, fueling, weather, anything your coach should know"
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving || (isExtra && !form.duration)}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[#CE0E2D] text-white hover:bg-[#b00c27] disabled:opacity-40">
          <Check className="w-3.5 h-3.5" /> {existing ? "Update log" : "Save log"}
        </button>
        {existing && (
          <button onClick={remove} disabled={saving} aria-label="Remove log"
            className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg text-[#737373] hover:text-white">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        )}
      </div>
      {status && <p className={`text-[11px] mt-2 ${status.ok ? "text-[#4ade80]" : "text-[#f87171]"}`}>{status.text}</p>}
      <p className="text-[10px] text-[#404040] mt-2">Your coach reads the past week of logs and notes when it plans your day.</p>
    </div>
  );
}

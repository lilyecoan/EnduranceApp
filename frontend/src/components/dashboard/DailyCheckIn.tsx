"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, ClipboardCheck } from "lucide-react";
import { useUnits } from "@/components/units/UnitsProvider";
import { listCheckIns, saveCheckIn, type CheckIn } from "@/lib/wellnessApi";
import { displayToKg, kgToDisplay, weightUnit } from "@/lib/units";
import { isoDate } from "@/lib/weekPlan";

const inputCls =
  "w-full text-sm bg-bg border border-stroke rounded-lg px-3 py-2 text-white placeholder:text-muted/60 focus:outline-none focus:border-muted";

const SCALES = [
  { key: "sleep_quality", label: "Sleep quality", low: "Awful", high: "Great" },
  { key: "energy", label: "Energy", low: "Drained", high: "Fresh" },
  { key: "soreness", label: "Soreness", low: "None", high: "Very sore" },
] as const;

type Form = { sleepHours: string; resting: string; hrv: string; weight: string; notes: string; sleep_quality: number | null; energy: number | null; soreness: number | null };

const empty: Form = { sleepHours: "", resting: "", hrv: "", weight: "", notes: "", sleep_quality: null, energy: null, soreness: null };

/** Morning check-in: how you feel plus numbers from your watch or scale. Works with no device connected. */
export function DailyCheckIn({ className = "", onSaved }: { className?: string; onSaved?: () => void }) {
  const { getToken, isSignedIn } = useAuth();
  const { units } = useUnits();
  const [today] = useState(() => isoDate(new Date()));
  const [form, setForm] = useState<Form>(empty);
  const [savedToday, setSavedToday] = useState(false);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listCheckIns(await getToken(), 2);
        const mine = list.find((c) => c.date === today);
        if (cancelled || !mine) return;
        setSavedToday(true);
        setOpen(false);
        setForm({
          sleepHours: mine.sleep_duration_seconds ? String(Math.round((mine.sleep_duration_seconds / 3600) * 10) / 10) : "",
          resting: mine.resting_hr ? String(mine.resting_hr) : "",
          hrv: mine.hrv_rmssd ? String(mine.hrv_rmssd) : "",
          weight: mine.weight_kg ? String(kgToDisplay(mine.weight_kg, units)) : "",
          notes: mine.checkin_notes ?? "",
          sleep_quality: mine.sleep_quality, energy: mine.energy, soreness: mine.soreness,
        });
      } catch {
        /* card still works for a new entry */
      }
    })();
    return () => {
      cancelled = true;
    };
    // units only matters for the initial prefill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, getToken, today]);

  async function save() {
    setSaving(true);
    setStatus(null);
    const n = (v: string) => (v.trim() === "" ? null : Number(v));
    const body: CheckIn = {
      date: today,
      resting_hr: n(form.resting),
      hrv_rmssd: n(form.hrv),
      sleep_duration_seconds: n(form.sleepHours) === null ? null : Math.round(n(form.sleepHours)! * 3600),
      weight_kg: n(form.weight) === null ? null : displayToKg(n(form.weight)!, units),
      sleep_quality: form.sleep_quality, energy: form.energy, soreness: form.soreness,
      checkin_notes: form.notes.trim() || null,
    };
    try {
      await saveCheckIn(await getToken(), body);
      setSavedToday(true);
      setOpen(false);
      setStatus({ ok: true, text: "Saved. Your coach will use it in today's plan." });
      onSaved?.();
    } catch {
      setStatus({ ok: false, text: "Couldn't save. Check the numbers and try again." });
    } finally {
      setSaving(false);
    }
  }

  const empty_ = Object.values(form).every((v) => v === "" || v === null);

  return (
    <div id="check-in" className={`scroll-mt-6 rounded-[24px] border border-stroke bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#4ade80]" />
          <h3 className="text-sm font-semibold text-white">Daily check-in</h3>
          {savedToday && <span className="text-[10px] font-bold text-[#4ade80] bg-[#16a34a]/10 px-2 py-0.5 rounded">Done today</span>}
        </div>
        {savedToday && (
          <button className="text-[11px] font-bold text-muted hover:text-white" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Edit"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted mb-3">
        30 seconds each morning. Everything is optional; type numbers from your watch or scale if it isn&apos;t connected.
      </p>

      {open && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            {SCALES.map((s) => (
              <div key={s.key}>
                <div className="text-[11px] font-bold text-muted mb-1">{s.label}</div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} type="button" aria-pressed={form[s.key] === v} aria-label={`${s.label} ${v} of 5`}
                      onClick={() => setForm({ ...form, [s.key]: form[s.key] === v ? null : v })}
                      className={`h-7 rounded text-[11px] font-bold ${form[s.key] === v ? "bg-lime text-ink" : "bg-surface2 text-muted hover:text-white"}`}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-muted/70 mt-0.5"><span>{s.low}</span><span>{s.high}</span></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <label className="text-[11px] font-bold text-muted space-y-1">
              <span>Sleep (hours)</span>
              <input className={inputCls} type="number" min={0} max={24} step={0.25} inputMode="decimal" value={form.sleepHours}
                onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-muted space-y-1">
              <span>Resting HR</span>
              <input className={inputCls} type="number" min={20} max={150} inputMode="numeric" value={form.resting}
                onChange={(e) => setForm({ ...form, resting: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-muted space-y-1">
              <span title="Overnight HRV as Garmin, WHOOP or Oura show it (rMSSD)">HRV (ms)</span>
              <input className={inputCls} type="number" min={1} max={300} inputMode="numeric" value={form.hrv}
                onChange={(e) => setForm({ ...form, hrv: e.target.value })} />
            </label>
            <label className="text-[11px] font-bold text-muted space-y-1">
              <span>Weight ({weightUnit(units)})</span>
              <input className={inputCls} type="number" min={40} max={700} step={0.1} inputMode="decimal" value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </label>
          </div>
          <label className="block text-[11px] font-bold text-muted space-y-1 mb-3">
            <span>Anything else?</span>
            <textarea className={`${inputCls} min-h-[56px] resize-y`} maxLength={1000} value={form.notes}
              placeholder="e.g. ankle a bit stiff, stressful week at work, period started, low glucose overnight"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <p className="text-[10px] text-muted/70 mb-3">HRV here means the overnight number from Garmin, WHOOP or Oura (rMSSD). Apple Watch HRV is a different measure, so leave it blank if that&apos;s what you have.</p>
          <button onClick={save} disabled={saving || empty_}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-lime text-ink hover:bg-lime/90 disabled:opacity-40">
            <Check className="w-3.5 h-3.5" /> {savedToday ? "Update check-in" : "Save check-in"}
          </button>
        </>
      )}
      {status && <p className={`text-[11px] mt-2 ${status.ok ? "text-[#4ade80]" : "text-[#f87171]"}`}>{status.text}</p>}
    </div>
  );
}

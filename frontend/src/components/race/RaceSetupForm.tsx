"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, Link2, Loader2, Sparkles } from "lucide-react";
import { useUnits } from "@/components/units/UnitsProvider";
import { importRace, saveRace, type Race } from "@/lib/raceApi";
import { GOALS, isMultisport } from "@/lib/raceTypes";
import {
  displayDistanceToMeters,
  displayShortToMeters,
  distanceUnit,
  metersToDisplayDistance,
  metersToDisplayShort,
  shortDistanceUnit,
  type Units,
} from "@/lib/units";

const FT_PER_M = 3.28084;
const inputCls =
  "w-full text-sm bg-bg border border-stroke rounded-lg px-3 py-2 text-white placeholder:text-muted/60 focus:outline-none focus:border-muted";
const labelCls = "text-[11px] font-bold text-muted space-y-1";

type Form = {
  race_type: string;
  race_url: string;
  name: string;
  race_date: string;
  start_time: string; // HH:MM
  location: string;
  goal_h: string;
  goal_m: string;
  swim: string;
  bike: string;
  run: string;
  elevation: string;
  products: string;
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function toForm(race: Race | null, goal: string | undefined, u: Units): Form {
  return {
    race_type: race?.race_type ?? goal ?? "half_iron",
    race_url: race?.race_url ?? "",
    name: race?.name ?? "",
    race_date: race?.race_date ?? "",
    start_time: race?.start_time?.slice(0, 5) ?? "",
    location: race?.location ?? "",
    goal_h: race?.goal_finish_minutes ? String(Math.floor(race.goal_finish_minutes / 60)) : "",
    goal_m: race?.goal_finish_minutes ? String(race.goal_finish_minutes % 60) : "",
    swim: race?.swim_distance_m != null ? String(metersToDisplayShort(race.swim_distance_m, u)) : "",
    bike: race?.bike_distance_km != null ? String(metersToDisplayDistance(race.bike_distance_km * 1000, u)) : "",
    run: race?.run_distance_km != null ? String(metersToDisplayDistance(race.run_distance_km * 1000, u)) : "",
    elevation: race?.elevation_gain_m != null ? String(Math.round(u === "imperial" ? race.elevation_gain_m * FT_PER_M : race.elevation_gain_m)) : "",
    products: (race?.course_info?.aid_station_products ?? []).join(", "),
  };
}

type Props = {
  race: Race | null;
  /** Race type chosen elsewhere (e.g. onboarding goal picker). */
  goal?: string;
  onSaved: (race: Race) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

/** Add or edit the goal race; can fill itself in from the race's web page. */
export function RaceSetupForm({ race, goal, onSaved, onCancel, submitLabel = "Save race" }: Props) {
  const { getToken } = useAuth();
  const { units } = useUnits();
  const [form, setForm] = useState<Form>(() => toForm(race, goal, units));
  const [extra, setExtra] = useState<Record<string, unknown>>(() => ({ ...(race?.course_info ?? {}) }));
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [filled, setFilled] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const multisport = isMultisport(form.race_type);

  async function fillFromLink() {
    setImporting(true);
    setNotices([]);
    setFilled([]);
    setError(null);
    try {
      const result = await importRace(await getToken(), form.race_url.trim() || null, pasted.trim() || null);
      const d = result.details;
      const patch: Partial<Form> = {};
      const got: string[] = [];
      const take = (key: keyof Form, value: string | null | undefined, label: string) => {
        if (value) {
          patch[key] = value;
          got.push(label);
        }
      };
      take("name", d.name, "name");
      take("race_date", d.date, "date");
      take("start_time", d.start_time?.slice(0, 5), "start time");
      take("location", d.location, "location");
      if (d.race_type && GOALS.some((g) => g.id === d.race_type)) take("race_type", d.race_type, "race type");
      take("swim", d.swim_distance_m != null ? String(metersToDisplayShort(d.swim_distance_m, units)) : null, "swim");
      take("bike", d.bike_distance_km != null ? String(metersToDisplayDistance(d.bike_distance_km * 1000, units)) : null, "bike");
      take("run", d.run_distance_km != null ? String(metersToDisplayDistance(d.run_distance_km * 1000, units)) : null, "run");
      take("elevation", d.elevation_gain_m != null
        ? String(Math.round(units === "imperial" ? d.elevation_gain_m * FT_PER_M : d.elevation_gain_m)) : null, "elevation");
      take("products", d.aid_station_products?.length ? d.aid_station_products.join(", ") : null, "aid-station products");
      set(patch);
      setExtra((e) => ({
        ...e,
        ...(d.water_temp_c != null ? { water_temp_c: d.water_temp_c } : {}),
        ...(d.aid_station_notes ? { aid_station_notes: d.aid_station_notes } : {}),
        ...(d.cutoffs ? { cutoffs: d.cutoffs } : {}),
        ...(d.course_notes?.length ? { course_notes: d.course_notes } : {}),
        ...(d.is_wetsuit_legal != null ? { is_wetsuit_legal: d.is_wetsuit_legal } : {}),
      }));
      setFilled(got);
      setNotices(result.notices.length || got.length ? result.notices : ["We couldn't find race details there. Fill them in below."]);
    } catch (e) {
      setNotices([e instanceof Error ? e.message : "Couldn't read that page."]);
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const goalMin = (num(form.goal_h) ?? 0) * 60 + (num(form.goal_m) ?? 0);
    const elevation = num(form.elevation);
    const products = form.products.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 10);
    const { is_wetsuit_legal, ...info } = extra as { is_wetsuit_legal?: boolean } & Record<string, unknown>;
    delete info.place_name;
    try {
      const saved = await saveRace(await getToken(), {
        race_type: form.race_type,
        name: form.name.trim(),
        race_date: form.race_date,
        location: form.location.trim() || null,
        race_url: form.race_url.trim() || null,
        start_time: form.start_time ? `${form.start_time}:00` : null,
        goal_finish_minutes: goalMin > 0 ? goalMin : null,
        swim_distance_m: multisport && num(form.swim) !== null ? displayShortToMeters(num(form.swim)!, units) : null,
        bike_distance_km: multisport && num(form.bike) !== null ? displayDistanceToMeters(num(form.bike)!, units) / 1000 : null,
        run_distance_km: num(form.run) !== null ? displayDistanceToMeters(num(form.run)!, units) / 1000 : null,
        elevation_gain_m: elevation === null ? null : units === "imperial" ? elevation / FT_PER_M : elevation,
        is_wetsuit_legal: is_wetsuit_legal ?? race?.is_wetsuit_legal ?? null,
        course_info: { ...info, aid_station_products: products },
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your race.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = form.name.trim() && form.race_date && !saving;

  return (
    <div className="space-y-4">
      <label className={`block ${labelCls}`}>
        <span>Race type</span>
        <select className={inputCls} value={form.race_type} onChange={(e) => set({ race_type: e.target.value })}>
          {GOALS.filter((g) => g.race).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </label>

      <div className="rounded-lg border border-stroke bg-bg p-3 space-y-2">
        <label className={`block ${labelCls}`}>
          <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> Official race page (optional)</span>
          <input className={inputCls} type="url" inputMode="url" placeholder="https://… the race's own page"
            value={form.race_url} onChange={(e) => set({ race_url: e.target.value })} />
        </label>
        <button type="button" className="text-[11px] font-bold text-muted hover:text-white" onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? "▾" : "▸"} Paste details from the athlete guide instead
        </button>
        {showPaste && (
          <textarea className={`${inputCls} min-h-[90px] resize-y`} maxLength={15000} value={pasted}
            placeholder="Paste the course, start-time and aid-station sections"
            onChange={(e) => setPasted(e.target.value)} />
        )}
        <button type="button" onClick={fillFromLink} disabled={importing || (!form.race_url.trim() && !pasted.trim())}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-stroke text-white hover:border-muted disabled:opacity-40">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#60a5fa]" />}
          Fill in details
        </button>
        {filled.length > 0 && <p className="text-[11px] text-[#4ade80]">Filled in: {filled.join(", ")}. Check them before saving.</p>}
        {notices.map((n, i) => <p key={i} className="text-[11px] text-[#fbbf24]">{n}</p>)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className={`col-span-2 ${labelCls}`}>
          <span>Race name</span>
          <input className={inputCls} value={form.name} maxLength={200} placeholder="e.g. IRONMAN 70.3 Galveston"
            onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className={labelCls}>
          <span>Date</span>
          <input className={inputCls} type="date" value={form.race_date} onChange={(e) => set({ race_date: e.target.value })} />
        </label>
        <label className={labelCls}>
          <span>Start time (local)</span>
          <input className={inputCls} type="time" value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} />
        </label>
        <label className={`col-span-2 ${labelCls}`}>
          <span>Location</span>
          <input className={inputCls} value={form.location} maxLength={200} placeholder="City, State/Region, Country"
            onChange={(e) => set({ location: e.target.value })} />
        </label>
        <div className={labelCls}>
          <span>Goal finish time (optional)</span>
          <div className="flex items-center gap-1">
            <input className={inputCls} type="number" min={0} max={48} placeholder="h" aria-label="Goal hours" value={form.goal_h}
              onChange={(e) => set({ goal_h: e.target.value })} />
            <span className="text-muted">:</span>
            <input className={inputCls} type="number" min={0} max={59} placeholder="mm" aria-label="Goal minutes" value={form.goal_m}
              onChange={(e) => set({ goal_m: e.target.value })} />
          </div>
        </div>
        <label className={labelCls}>
          <span>Course climbing ({units === "imperial" ? "ft" : "m"}, optional)</span>
          <input className={inputCls} type="number" min={0} value={form.elevation} onChange={(e) => set({ elevation: e.target.value })} />
        </label>
        {multisport && (
          <>
            <label className={labelCls}>
              <span>Swim ({shortDistanceUnit(units)})</span>
              <input className={inputCls} type="number" min={0} value={form.swim} onChange={(e) => set({ swim: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span>Bike ({distanceUnit(units)})</span>
              <input className={inputCls} type="number" min={0} step={0.1} value={form.bike} onChange={(e) => set({ bike: e.target.value })} />
            </label>
          </>
        )}
        <label className={labelCls}>
          <span>Run ({distanceUnit(units)})</span>
          <input className={inputCls} type="number" min={0} step={0.1} value={form.run} onChange={(e) => set({ run: e.target.value })} />
        </label>
        <label className={`col-span-2 ${labelCls}`}>
          <span>Aid-station products (optional)</span>
          <input className={inputCls} value={form.products} placeholder="e.g. Gatorade Endurance, Maurten gels"
            onChange={(e) => set({ products: e.target.value })} />
        </label>
      </div>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <button className="text-xs font-bold px-4 py-2 rounded-lg text-muted hover:text-white" onClick={onCancel}>Cancel</button>}
        <button onClick={save} disabled={!canSave}
          className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-lime text-ink hover:bg-lime/90 disabled:opacity-40">
          <Check className="w-3.5 h-3.5" /> {submitLabel}
        </button>
      </div>
    </div>
  );
}

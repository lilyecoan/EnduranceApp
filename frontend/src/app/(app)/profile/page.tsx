"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { useCoachingPlan } from "@/hooks/useCoachingPlan";
import { StatCard } from "@/components/dashboard/StatCard";
import { Zap, Heart, Activity, Target, AlertCircle, Info } from "lucide-react";
import type { AthleteProfile } from "@/lib/profileApi";

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type FormState = {
  age: string;
  weight_kg: string;
  ftp_watts: string;
  vo2_max: string;
  max_hr: string;
  lactate_threshold_hr: string;
  resting_hr: string;
  swim_pace_per_100m: string;
  run_threshold_pace: string;
  has_type1_diabetes: boolean;
};

function toFormState(profile: AthleteProfile | null): FormState {
  const field = (v: number | null) => (v ?? "").toString();
  return {
    age: field(profile?.age ?? null),
    weight_kg: field(profile?.weight_kg ?? null),
    ftp_watts: field(profile?.ftp_watts ?? null),
    vo2_max: field(profile?.vo2_max ?? null),
    max_hr: field(profile?.max_hr ?? null),
    lactate_threshold_hr: field(profile?.lactate_threshold_hr ?? null),
    resting_hr: field(profile?.resting_hr ?? null),
    swim_pace_per_100m: field(profile?.swim_pace_per_100m ?? null),
    run_threshold_pace: field(profile?.run_threshold_pace ?? null),
    has_type1_diabetes: profile?.has_type1_diabetes ?? false,
  };
}

function hrZonesFor(maxHr: number) {
  const pct = (p: number) => Math.round(maxHr * p);
  return [
    { zone: "Z1", name: "Active Recovery", pct: "< 60% HR", range: `< ${pct(0.6)} bpm`, bar: "bg-[#1e3a5f]" },
    { zone: "Z2", name: "Aerobic Base", pct: "60–75% HR", range: `${pct(0.6)}–${pct(0.75)} bpm`, bar: "bg-[#14532d]" },
    { zone: "Z3", name: "Tempo", pct: "75–83% HR", range: `${pct(0.75)}–${pct(0.83)} bpm`, bar: "bg-[#713f12]" },
    { zone: "Z4", name: "Threshold", pct: "83–90% HR", range: `${pct(0.83)}–${pct(0.9)} bpm`, bar: "bg-[#7c2d12]" },
    { zone: "Z5", name: "VO₂ Max", pct: "> 90% HR", range: `> ${pct(0.9)} bpm`, bar: "bg-[#CE0E2D]/80" },
  ];
}

function powerZonesFor(ftp: number) {
  const pct = (p: number) => Math.round(ftp * p);
  return [
    { zone: "Z1", name: "Active Recovery", pct: "< 60% FTP", range: `< ${pct(0.6)}W` },
    { zone: "Z2", name: "Endurance", pct: "60–80% FTP", range: `${pct(0.6)}–${pct(0.8)}W` },
    { zone: "Z3", name: "Tempo", pct: "80–90% FTP", range: `${pct(0.8)}–${pct(0.9)}W` },
    { zone: "Z4", name: "Threshold", pct: "90–105% FTP", range: `${pct(0.9)}–${pct(1.05)}W` },
    { zone: "Z5", name: "VO₂ Max", pct: "105–120% FTP", range: `${pct(1.05)}–${pct(1.2)}W` },
    { zone: "Z6", name: "Anaerobic", pct: "> 120% FTP", range: `> ${pct(1.2)}W` },
  ];
}

export default function ProfilePage() {
  const { user } = useUser();
  const { profile, loading, save } = useAthleteProfile();
  const { plan } = useCoachingPlan();
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncedProfile, setSyncedProfile] = useState<AthleteProfile | null>(null);

  // Adjust local form state when the fetched profile changes, following
  // React's recommended pattern of computing it during render rather than
  // in an effect (avoids an extra render-then-fetch cascade).
  if (profile !== syncedProfile) {
    setSyncedProfile(profile);
    setForm(toFormState(profile));
    if (profile && !profile.is_complete) setEditing(true);
  }

  const handleSave = async () => {
    setSaving(true);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    await save({
      age: num(form.age) as number | null,
      weight_kg: num(form.weight_kg),
      ftp_watts: num(form.ftp_watts),
      vo2_max: num(form.vo2_max),
      max_hr: num(form.max_hr) as number | null,
      lactate_threshold_hr: num(form.lactate_threshold_hr) as number | null,
      resting_hr: num(form.resting_hr) as number | null,
      swim_pace_per_100m: num(form.swim_pace_per_100m),
      run_threshold_pace: num(form.run_threshold_pace),
      has_type1_diabetes: form.has_type1_diabetes,
    });
    setSaving(false);
    setEditing(false);
  };

  const displayName = user?.fullName || profile?.full_name || "Athlete";
  const performance = plan?.performance;

  if (loading) {
    return <div className="p-6 text-sm text-[#525252]">Loading profile…</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Athlete Profile</p>
          <h1 className="text-2xl font-black text-white tracking-tight">{displayName}</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            {profile?.primary_race_name ? `Race goal: ${profile.primary_race_name}` : "No race goal set yet"}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-bold text-white bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 mb-6">
          {profile && !profile.is_complete && (
            <p className="text-xs text-[#fbbf24] mb-4">
              Complete your profile to unlock real coaching data instead of generic defaults.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {([
              ["age", "Age"],
              ["weight_kg", "Weight (kg)"],
              ["ftp_watts", "FTP (W)"],
              ["vo2_max", "VO₂ Max"],
              ["max_hr", "Max HR (bpm)"],
              ["lactate_threshold_hr", "Threshold HR (bpm)"],
              ["resting_hr", "Resting HR (bpm)"],
              ["swim_pace_per_100m", "Swim pace (sec/100m)"],
              ["run_threshold_pace", "Run threshold pace (sec/km)"],
            ] as [keyof FormState, string][]).map(([key, label]) => (
              <label key={key} className="text-xs text-[#737373]">
                {label}
                <input
                  type="number"
                  value={form[key] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full bg-[#151515] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#CE0E2D]/50"
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#737373] mb-4">
            <input
              type="checkbox"
              checked={form.has_type1_diabetes}
              onChange={(e) => setForm((f) => ({ ...f, has_type1_diabetes: e.target.checked }))}
            />
            Type 1 Diabetes
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 font-black text-sm rounded-lg bg-[#CE0E2D] hover:bg-[#E31837] text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {profile?.is_complete && (
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 font-bold text-sm rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#737373]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Performance Metrics */}
          <div className="mb-6">
            <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3">Performance Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="FTP" value={profile?.ftp_watts ?? "—"} unit="W" icon={Zap} />
              <StatCard label="VO₂ Max" value={profile?.vo2_max ?? "—"} unit="ml/kg/min" icon={Activity} />
              <StatCard label="Resting HR" value={profile?.resting_hr ?? "—"} unit="bpm" icon={Heart} />
              <StatCard
                label="Swim Pace"
                value={profile?.swim_pace_per_100m ? formatMMSS(profile.swim_pace_per_100m) : "—"}
                unit={profile?.swim_pace_per_100m ? "/100m" : ""}
                icon={Activity}
              />
              <StatCard
                label="Run Threshold Pace"
                value={profile?.run_threshold_pace ? formatMMSS(profile.run_threshold_pace) : "—"}
                unit={profile?.run_threshold_pace ? "/km" : ""}
                icon={Activity}
              />
              <StatCard label="Max HR" value={profile?.max_hr ?? "—"} unit="bpm" icon={Heart} />
            </div>
          </div>

          {/* Performance profile from the real coaching pipeline */}
          {performance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
                <h3 className="text-xs font-black text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4" /> Performance Levels
                </h3>
                <ul className="space-y-1.5 text-sm text-[#737373]">
                  <li>Swim: {performance.swim_level}</li>
                  <li>Bike: {performance.bike_level}</li>
                  <li>Run: {performance.run_level}</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#d97706]/20 bg-[#d97706]/5 p-4">
                <h3 className="text-xs font-black text-[#fbbf24] mb-3 uppercase tracking-wider">Primary Limiter</h3>
                <p className="text-sm text-[#737373]">{performance.primary_limiter}</p>
              </div>
            </div>
          )}

          {/* Medical */}
          {profile?.has_type1_diabetes && (
            <div className="mb-6">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#fbbf24]" /> Medical
              </p>
              <div className="rounded-xl border border-[#CE0E2D]/25 bg-[#CE0E2D]/5 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-black text-[#f87171]">Type 1 Diabetes</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#CE0E2D]/15 text-[#f87171] border border-[#CE0E2D]/20">
                    Active
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-[#151515] rounded-lg p-2.5">
                  <Info className="w-3.5 h-3.5 text-[#525252] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#737373] leading-relaxed">
                    These suggestions are general training support information only, not medical advice. Always
                    consult your endocrinologist or diabetes care team for insulin management and medical decisions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Training Zones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-0.5">Heart Rate Zones</p>
              {profile?.max_hr ? (
                <>
                  <p className="text-[10px] text-[#404040] mb-3">Max HR: {profile.max_hr} bpm</p>
                  <div className="space-y-2">
                    {hrZonesFor(profile.max_hr).map((z) => (
                      <div key={z.zone} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#151515] border border-[#1e1e1e]">
                        <div className={`w-1.5 h-6 rounded-full ${z.bar} flex-shrink-0`} />
                        <span className="text-[10px] font-black text-[#525252] w-5">{z.zone}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">{z.name}</div>
                          <div className="text-[10px] text-[#404040]">{z.pct}</div>
                        </div>
                        <span className="text-[10px] text-[#737373] font-mono">{z.range}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#525252] mt-2">Add your max HR to see zones.</p>
              )}
            </div>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4">
              <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-0.5">Cycling Power Zones</p>
              {profile?.ftp_watts ? (
                <>
                  <p className="text-[10px] text-[#404040] mb-3">FTP: {profile.ftp_watts}W</p>
                  <div className="space-y-2">
                    {powerZonesFor(profile.ftp_watts).map((z, i) => (
                      <div key={z.zone} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#151515] border border-[#1e1e1e]">
                        <div
                          className="w-1.5 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `hsl(${200 + i * 25}, 80%, ${45 + i * 5}%)` }}
                        />
                        <span className="text-[10px] font-black text-[#525252] w-5">{z.zone}</span>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-white">{z.name}</div>
                          <div className="text-[10px] text-[#404040]">{z.pct}</div>
                        </div>
                        <span className="text-[10px] text-[#fbbf24] font-mono">{z.range}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#525252] mt-2">Add your FTP to see power zones.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

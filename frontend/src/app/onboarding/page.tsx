"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Smartphone, Upload, Watch, Zap } from "lucide-react";
import DataSources from "@/components/settings/DataSources";
import type { ProviderId } from "@/lib/connectionsApi";
import { completeOnboarding, updateProfile } from "@/lib/profileApi";
import { displayToKg, weightUnit } from "@/lib/units";
import { UnitsToggle, useUnits } from "@/components/units/UnitsProvider";
import { RaceSetupForm } from "@/components/race/RaceSetupForm";
import { setTrainingGoal } from "@/lib/raceApi";
import { GOALS } from "@/lib/raceTypes";

type DeviceId = "garmin" | "apple" | "other_watch" | "strava" | "none";

type Guide = {
  label: string;
  hint: string;
  icon: typeof Watch;
  steps: React.ReactNode[];
  sources: ProviderId[];
  alternative?: { label: string; steps: React.ReactNode[] };
};

const ext = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline inline-flex items-center gap-0.5">
    {text} <ExternalLink className="w-3 h-3" />
  </a>
);

const GUIDES: Record<Exclude<DeviceId, "none">, Guide> = {
  garmin: {
    label: "Garmin watch",
    hint: "Workouts, HRV, sleep, resting HR, training load",
    icon: Watch,
    steps: [
      <><b>On iPhone (works best right now):</b> in Garmin Connect open <b>More → Settings → Connected Apps → Apple Health</b> and turn sharing on. Then set up <b>Apple Health (automatic)</b> below. Workouts, sleep, steps and heart rate come through (Garmin doesn&apos;t share HRV).</>,
      <><b>Or via Intervals.icu:</b> create a free account at {ext("https://intervals.icu", "intervals.icu")}, connect Garmin under <b>Settings → Connections</b>, then connect Intervals.icu below. Garmin has recently limited what Intervals.icu can pass on, so this may bring in little or nothing.</>,
      <>No connection at all? Use the <b>daily check-in</b> on your dashboard to type in resting HR, HRV and sleep from your watch.</>,
    ],
    sources: ["health_auto_export", "intervals_icu", "file_upload"],
    alternative: {
      label: "Prefer not to create another account? Upload your Garmin data instead",
      steps: [
        <>Single workouts: in Garmin Connect open an activity → ⚙ → <b>Export Original</b>, then upload the .fit / .zip below.</>,
        <>Full history: Garmin Connect → <b>Account → Data Management → Export Your Data</b>. Garmin emails a download link (can take a day); upload that .zip below.</>,
      ],
    },
  },
  apple: {
    label: "Apple Watch / iPhone",
    hint: "Workouts, resting HR, HRV, sleep, weight",
    icon: Smartphone,
    steps: [
      <><b>Automatic:</b> set up <b>Apple Health (automatic)</b> below with the Health Auto Export app. New workouts, sleep, HRV and resting HR arrive on their own.</>,
      <><b>One-off upload instead:</b> in the Health app tap your profile picture → <b>Export All Health Data</b>, then upload <b>export.zip</b> below. Re-upload whenever you like; duplicates are skipped.</>,
    ],
    sources: ["health_auto_export", "file_upload"],
  },
  other_watch: {
    label: "Other watch (COROS, Wahoo, Polar, Suunto…)",
    hint: "Sync via Intervals.icu, or upload .fit files",
    icon: Zap,
    steps: [
      <>Check whether your brand is listed under <b>Settings → Connections</b> on {ext("https://intervals.icu", "intervals.icu")}; if so, connect it there and then connect Intervals.icu below.</>,
      <>Otherwise, export workouts from your watch&apos;s app as <b>.fit</b> files and upload them (or a .zip of them) below.</>,
    ],
    sources: ["intervals_icu", "file_upload"],
  },
  strava: {
    label: "I only use Strava",
    hint: "Workouts only — not used by the AI coach",
    icon: Upload,
    steps: [
      <>Connect Strava below to bring in your workouts.</>,
      <>Strava doesn&apos;t provide sleep or HRV, and its terms don&apos;t allow its data to be used with AI, so Strava workouts are shown to you but not sent to your coach. For coaching, also connect Intervals.icu or upload files.</>,
    ],
    sources: ["strava", "intervals_icu", "file_upload"],
  },
};

const inputCls =
  "w-full text-sm bg-bg border border-stroke rounded-lg px-3 py-2 text-white placeholder:text-muted/60 focus:outline-none focus:border-muted";
const primaryCls =
  "flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-lime text-ink hover:bg-lime/90 disabled:opacity-40";
const ghostCls = "flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-muted hover:text-white";

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const { getToken } = useAuth();
  const { units } = useUnits();
  // Returning from a provider's consent screen lands back on the data step.
  // Captured once: DataSources strips ?source= from the URL after reading it.
  const [returnedFrom] = useState(params.get("source"));
  const [step, setStep] = useState(returnedFrom ? 3 : 1);
  const [goal, setGoal] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceId | null>(null);
  const [showAlt, setShowAlt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [about, setAbout] = useState({
    age: "",
    weight: "",
    ftp_watts: "",
    chronic_conditions: "",
    injuries: "",
    dietary_restrictions: "",
  });

  async function saveAbout() {
    setSaving(true);
    setError(null);
    const updates: Record<string, number | string> = {
      chronic_conditions: about.chronic_conditions,
      injuries: about.injuries,
      dietary_restrictions: about.dietary_restrictions,
    };
    if (about.age) updates.age = Number(about.age);
    if (about.weight) updates.weight_kg = displayToKg(Number(about.weight), units);
    if (about.ftp_watts) updates.ftp_watts = Number(about.ftp_watts);
    const saved = await updateProfile(await getToken(), updates);
    setSaving(false);
    if (!saved) {
      setError("Couldn't save your details — check your connection and try again.");
      return;
    }
    setStep(2);
  }

  async function chooseGoal(id: string) {
    setGoal(id);
    setGoalError(null);
    try {
      await setTrainingGoal(await getToken(), id);
    } catch {
      setGoalError("Couldn't save your goal. You can set it later on the Race tab.");
    }
  }

  async function finish() {
    setSaving(true);
    await completeOnboarding(await getToken());
    router.replace("/");
  }

  const guide = device && device !== "none" ? GUIDES[device] : null;

  return (
    <div className="min-h-screen bg-bg flex justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <p className="text-sm font-medium text-muted mb-1.5">Welcome to IronMind</p>
        <div className="flex items-start justify-between">
          <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px] mb-1">Let&apos;s set up your coaching</h1>
          <button className={ghostCls} disabled={saving} onClick={finish}>Skip setup</button>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {["About you", "Your goal", "Your training data", "Done"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                step > i + 1 ? "bg-[#16a34a] text-white" : step === i + 1 ? "bg-lime text-ink" : "bg-surface2 text-muted/70"}`}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className={`text-[11px] font-bold ${step === i + 1 ? "text-white" : "text-muted/70"}`}>{label}</span>
              {i < 3 && <span className="w-6 h-px bg-[#262626]" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-[24px] border border-stroke bg-surface p-6 space-y-4">
            <p className="text-sm text-fg/80">A few basics so recommendations fit you. You can change these later in Profile.</p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-muted">Units</span>
              <UnitsToggle />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold text-muted space-y-1">
                <span>Age</span>
                <input className={inputCls} type="number" min={13} max={100} value={about.age}
                  onChange={(e) => setAbout({ ...about, age: e.target.value })} />
              </label>
              <label className="text-[11px] font-bold text-muted space-y-1">
                <span>Weight ({weightUnit(units)})</span>
                <input className={inputCls} type="number" min={25} max={550} step="0.1" value={about.weight}
                  onChange={(e) => setAbout({ ...about, weight: e.target.value })} />
              </label>
              <label className="text-[11px] font-bold text-muted space-y-1">
                <span>Cycling FTP (watts, optional)</span>
                <input className={inputCls} type="number" min={50} max={600} value={about.ftp_watts}
                  onChange={(e) => setAbout({ ...about, ftp_watts: e.target.value })} />
              </label>
            </div>
            {(
              [
                ["chronic_conditions", "Chronic illnesses or medical conditions",
                  "e.g. type 1 diabetes, asthma, Hashimoto's — anything your coach should plan around"],
                ["injuries", "Current or past injuries", "e.g. IT band syndrome (2024), stress fracture left foot"],
                ["dietary_restrictions", "Dietary restrictions", "e.g. celiac / gluten-free, vegetarian, nut allergy"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block text-[11px] font-bold text-muted space-y-1">
                <span>{label} <span className="font-normal text-muted">(optional)</span></span>
                <textarea className={`${inputCls} min-h-[64px] resize-y`} maxLength={2000} placeholder={placeholder}
                  value={about[key]} onChange={(e) => setAbout({ ...about, [key]: e.target.value })} />
              </label>
            ))}
            <p className="text-[10px] text-muted">
              Only you and your coaching plan use this. It isn&apos;t medical advice — check changes with your doctor.
            </p>
            {error && <p className="text-xs text-[#f87171]">{error}</p>}
            <div className="flex justify-between pt-2">
              <button className={ghostCls} onClick={() => setStep(2)}>Skip for now</button>
              <button className={primaryCls} disabled={saving} onClick={saveAbout}>
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-[24px] border border-stroke bg-surface p-6 space-y-4">
            <p className="text-sm text-fg/80">What are you training for?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GOALS.map((g) => (
                <button key={g.id} type="button" onClick={() => chooseGoal(g.id)} aria-pressed={goal === g.id}
                  className={`text-left text-xs font-bold px-3 py-2.5 rounded-lg border ${goal === g.id
                    ? "border-lime bg-lime/10 text-fg" : "border-stroke bg-surface2 text-fg/80 hover:border-muted"}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {goalError && <p className="text-xs text-[#f87171]">{goalError}</p>}
            {goal && GOALS.find((g) => g.id === goal)?.race && (
              <div className="border-t border-stroke pt-4">
                <p className="text-sm text-fg/80 mb-3">
                  Signed up already? Add the race and we&apos;ll build a race-day nutrition plan for it.
                </p>
                <RaceSetupForm key={goal} race={null} goal={goal} onSaved={() => setStep(3)} submitLabel="Save race & continue" />
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button className={ghostCls} onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button className={goal && !GOALS.find((g) => g.id === goal)?.race ? primaryCls : ghostCls} onClick={() => setStep(3)}>
                {goal && GOALS.find((g) => g.id === goal)?.race ? "Add race details later" : "Continue"} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {!device && !returnedFrom && (
              <div className="rounded-[24px] border border-stroke bg-surface p-6">
                <p className="text-sm text-fg/80 mb-4">What do you train with? We&apos;ll show you the easiest way to bring your data in.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(Object.entries(GUIDES) as [Exclude<DeviceId, "none">, Guide][]).map(([id, g]) => (
                    <button key={id} onClick={() => setDevice(id)}
                      className="text-left p-4 rounded-lg border border-stroke bg-surface2 hover:border-muted">
                      <g.icon className="w-4 h-4 text-[#60a5fa] mb-2" />
                      <div className="text-sm font-semibold text-white">{g.label}</div>
                      <div className="text-[11px] text-muted">{g.hint}</div>
                    </button>
                  ))}
                  <button onClick={() => setStep(4)}
                    className="text-left p-4 rounded-lg border border-dashed border-stroke hover:border-muted">
                    <div className="text-sm font-semibold text-fg/80">No device / set up later</div>
                    <div className="text-[11px] text-muted">You&apos;ll see demo data until you connect something</div>
                  </button>
                </div>
              </div>
            )}

            {guide && (
              <div className="rounded-[24px] border border-stroke bg-surface p-6">
                <h2 className="text-sm font-semibold text-white mb-3">{guide.label}: how to connect</h2>
                <ol className="space-y-2 mb-3">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-xs text-fg/80">
                      <span className="w-5 h-5 rounded-full bg-surface2 text-[10px] font-semibold text-muted flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
                {guide.alternative && (
                  <div className="border-t border-stroke pt-3">
                    <button className="text-[11px] font-bold text-muted hover:text-white" onClick={() => setShowAlt((v) => !v)}>
                      {showAlt ? "▾" : "▸"} {guide.alternative.label}
                    </button>
                    {showAlt && (
                      <ul className="mt-2 space-y-1.5 list-disc pl-5">
                        {guide.alternative.steps.map((s, i) => <li key={i} className="text-xs text-fg/80">{s}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {(guide || returnedFrom) && (
              <DataSources embedded returnTo="/onboarding" only={guide?.sources} />
            )}

            <div className="flex justify-between">
              <button className={ghostCls} onClick={() => (device ? setDevice(null) : setStep(2))}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              {(guide || returnedFrom) && (
                <button className={primaryCls} onClick={() => setStep(4)}>
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-[24px] border border-stroke bg-surface p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">You&apos;re set</h2>
            <p className="text-sm text-fg/80">
              Your dashboard uses your own data wherever you&apos;ve connected it, and clearly labeled demo data everywhere
              else. You can add or remove data sources any time in <b>Settings</b>.
            </p>
            <div className="flex justify-between pt-2">
              <button className={ghostCls} onClick={() => setStep(3)}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button className={primaryCls} disabled={saving} onClick={finish}>
                Go to my dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}

"use client";
import { CheckCircle, Link, Clock } from "lucide-react";
import { useGarminData } from "@/hooks/useGarminData";

export default function SettingsPage() {
  const { source } = useGarminData();
  const garminConnected = source === "live";

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Configuration</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-sm text-[#525252] mt-0.5">Connect data sources and configure your coaching platform</p>
      </div>

      {/* Garmin */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
              <Link className="w-4 h-4 text-[#60a5fa]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Garmin Connect</h3>
              <p className="text-xs text-[#525252]">HRV, sleep, activities, training load</p>
            </div>
          </div>
          {garminConnected ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#4ade80] bg-[#16a34a]/10 border border-[#16a34a]/20 px-3 py-1 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" /> Connected
            </span>
          ) : (
            <span className="text-[10px] font-bold text-[#404040] bg-[#1a1a1a] border border-[#222] px-3 py-1 rounded-full uppercase tracking-wider">
              Not connected — showing demo data
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#404040] mb-3">
          Per-athlete Garmin connection isn&apos;t available yet — it requires approval from Garmin&apos;s
          Connect Developer Program, which hasn&apos;t been applied for. Until then this shows a shared
          demo/fixture data source.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {["HRV & Recovery", "Sleep Analysis", "Training Load (CTL/ATL)", "FTP & Power", "VO₂ Max", "Activities"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-[11px] text-[#525252] bg-[#151515] rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-[#4ade80] flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Future Integrations */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Future Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Apple Health", status: "Phase 3", desc: "iPhone HealthKit companion" },
            { name: "WHOOP", status: "Phase 3", desc: "Sleep & strain" },
            { name: "Dexcom G7", status: "Later", desc: "Real-time CGM data" },
            { name: "Libre 3", status: "Later", desc: "Continuous glucose" },
            { name: "Strava", status: "Later", desc: "Activity sync" },
            { name: "TrainingPeaks", status: "Later", desc: "Plan sync" },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg border border-[#1e1e1e] bg-[#151515]">
              <Clock className="w-4 h-4 flex-shrink-0 text-[#303030]" />
              <div>
                <div className="text-xs font-bold text-[#525252]">{item.name}</div>
                <div className="text-[10px] text-[#404040]">{item.desc}</div>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded text-[#404040] bg-[#1a1a1a]">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

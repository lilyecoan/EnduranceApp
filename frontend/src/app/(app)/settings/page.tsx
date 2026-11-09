"use client";
import { Clock } from "lucide-react";
import DataSources from "@/components/settings/DataSources";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#CE0E2D] uppercase tracking-[0.2em] mb-1">Configuration</p>
        <h1 className="text-2xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-sm text-[#525252] mt-0.5">Connect data sources and configure your coaching platform</p>
      </div>

      <DataSources />

      {/* Future Integrations */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Future Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Garmin (direct)", status: "Paused", desc: "Garmin's developer program is closed to new apps" },
            { name: "Apple Health app", status: "Phase 3", desc: "Automatic iPhone sync (export upload works now)" },
            { name: "WHOOP", status: "Phase 3", desc: "Sleep & strain" },
            { name: "Dexcom G7", status: "Later", desc: "Real-time CGM data" },
            { name: "Libre 3", status: "Later", desc: "Continuous glucose" },
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

"use client";
import { Clock } from "lucide-react";
import DataSources from "@/components/settings/DataSources";
import { UnitsToggle } from "@/components/units/UnitsProvider";

export default function SettingsPage() {
  return (
    <div className="px-5 py-7 lg:px-10 lg:py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm font-medium text-muted mb-1.5">Configuration</p>
        <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px]">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Connect data sources and configure your coaching platform</p>
      </div>

      <div className="rounded-[24px] border border-stroke bg-surface p-5 mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-1">Units</p>
          <p className="text-xs text-muted">Weight, distances, run and swim paces, fluids and temperature.</p>
        </div>
        <UnitsToggle />
      </div>

      <DataSources />

      {/* Future Integrations */}
      <div className="rounded-[24px] border border-stroke bg-surface p-5">
        <p className="text-[9px] font-bold text-muted uppercase tracking-[0.15em] mb-4">Future Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Garmin (direct)", status: "Paused", desc: "Garmin's developer program is closed to new apps" },
            { name: "Apple Health app", status: "Phase 3", desc: "Automatic iPhone sync (export upload works now)" },
            { name: "WHOOP", status: "Phase 3", desc: "Sleep & strain" },
            { name: "Dexcom G7", status: "Later", desc: "Real-time CGM data" },
            { name: "Libre 3", status: "Later", desc: "Continuous glucose" },
            { name: "TrainingPeaks", status: "Later", desc: "Plan sync" },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg border border-stroke bg-surface2">
              <Clock className="w-4 h-4 flex-shrink-0 text-muted/70" />
              <div>
                <div className="text-xs font-bold text-muted">{item.name}</div>
                <div className="text-[10px] text-muted/70">{item.desc}</div>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded text-muted/70 bg-surface2">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

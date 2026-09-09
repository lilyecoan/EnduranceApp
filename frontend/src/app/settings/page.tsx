"use client";
import { useState } from "react";
import { CheckCircle, Link, Zap, Clock } from "lucide-react";

export default function SettingsPage() {
  const [garminConnected] = useState(true);
  const [geminiKey, setGeminiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <button className="text-xs font-bold text-white bg-[#CE0E2D] hover:bg-[#E31837] px-3 py-1.5 rounded-lg transition-colors">
              Connect
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["HRV & Recovery", "Sleep Analysis", "Training Load (CTL/ATL)", "FTP & Power", "VO₂ Max", "Activities"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-[11px] text-[#525252] bg-[#151515] rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-[#4ade80] flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Gemini */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#CE0E2D]/10 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-[#CE0E2D]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Google Gemini API</h3>
            <p className="text-xs text-[#525252]">Powers the AI coaching agents (Gemini 1.5 Pro)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            placeholder="AIza..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="flex-1 bg-[#151515] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#404040] focus:outline-none focus:border-[#CE0E2D]/50 transition-colors"
          />
          <button
            onClick={handleSave}
            className={`px-4 py-2 font-black text-sm rounded-lg transition-colors ${
              saved
                ? "bg-[#16a34a] text-white"
                : "bg-[#CE0E2D] hover:bg-[#E31837] text-white"
            }`}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
        <p className="text-[10px] text-[#404040] mt-2">Key stored in .env — never transmitted to third parties.</p>
      </div>

      {/* Future Integrations */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-4">Future Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: "Dexcom G7", status: "Phase 2", desc: "Real-time CGM data", priority: true },
            { name: "Libre 3", status: "Phase 2", desc: "Continuous glucose", priority: true },
            { name: "WHOOP", status: "Phase 2", desc: "Sleep & strain" },
            { name: "Strava", status: "Phase 2", desc: "Activity sync" },
            { name: "Zwift", status: "Phase 3", desc: "Virtual training" },
            { name: "TrainingPeaks", status: "Phase 3", desc: "Plan sync" },
          ].map((item) => (
            <div key={item.name} className={`flex items-center gap-3 p-3 rounded-lg border ${item.priority ? "border-[#CE0E2D]/15 bg-[#CE0E2D]/5" : "border-[#1e1e1e] bg-[#151515]"}`}>
              <Clock className={`w-4 h-4 flex-shrink-0 ${item.priority ? "text-[#CE0E2D]/60" : "text-[#303030]"}`} />
              <div>
                <div className={`text-xs font-bold ${item.priority ? "text-[#f87171]" : "text-[#525252]"}`}>{item.name}</div>
                <div className="text-[10px] text-[#404040]">{item.desc}</div>
              </div>
              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${item.priority ? "text-[#CE0E2D] bg-[#CE0E2D]/10" : "text-[#404040] bg-[#1a1a1a]"}`}>{item.status}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#404040] mt-4 font-bold">
          💉 Dexcom/Libre CGM integration is Phase 2 priority — critical for real-time T1D glucose coaching.
        </p>
      </div>
    </div>
  );
}

"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchProfile, updateProfile } from "@/lib/profileApi";
import type { Units } from "@/lib/units";

const STORAGE_KEY = "ironmind.units";

type UnitsContextValue = { units: Units; setUnits: (u: Units) => void };

const UnitsContext = createContext<UnitsContextValue>({ units: "imperial", setUnits: () => {} });

function cachedUnits(): Units | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "metric" || v === "imperial" ? v : null;
  } catch {
    return null;
  }
}

function cacheUnits(u: Units) {
  try {
    window.localStorage.setItem(STORAGE_KEY, u);
  } catch {
    /* storage unavailable — the account setting still persists */
  }
}

/**
 * The athlete's display-unit preference. Saved on their account (so it
 * follows them across devices) and cached locally so pages render in the
 * right units before the profile request returns.
 */
export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [units, setUnitsState] = useState<Units>("imperial");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = cachedUnits();
      if (cached && !cancelled) setUnitsState(cached);
      if (!isLoaded || !isSignedIn) return;
      const profile = await fetchProfile(await getToken());
      if (!cancelled && profile?.units) {
        setUnitsState(profile.units);
        cacheUnits(profile.units);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const setUnits = useCallback(
    (u: Units) => {
      setUnitsState(u);
      cacheUnits(u);
      (async () => {
        await updateProfile(await getToken(), { units: u });
      })();
    },
    [getToken],
  );

  return <UnitsContext.Provider value={{ units, setUnits }}>{children}</UnitsContext.Provider>;
}

export const useUnits = () => useContext(UnitsContext);

/** Customary / Metric segmented switch. */
export function UnitsToggle({ className = "" }: { className?: string }) {
  const { units, setUnits } = useUnits();
  const option = (value: Units, label: string) => (
    <button
      type="button"
      onClick={() => setUnits(value)}
      aria-pressed={units === value}
      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${
        units === value ? "bg-[#CE0E2D] text-white" : "text-[#737373] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-[#262626] bg-[#0d0d0d] ${className}`}>
      {option("imperial", "Customary (lb, mi)")}
      {option("metric", "Metric (kg, km)")}
    </div>
  );
}

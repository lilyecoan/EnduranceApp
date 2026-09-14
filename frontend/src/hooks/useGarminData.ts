"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchGarminSnapshot, type GarminSnapshot } from "@/lib/garminApi";
import { mockGarminData } from "@/lib/mockData";

const REFRESH_MS = 5 * 60 * 1000; // refresh every 5 minutes

export function useGarminData() {
  const { getToken } = useAuth();
  const [data, setData] = useState<GarminSnapshot>(mockGarminData);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      const result = await fetchGarminSnapshot(token);
      if (cancelled) return;
      setData(result.data);
      setSource(result.source);
      setAsOf(result.asOf);
      setLoading(false);
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [getToken]);

  return { data, source, isLive: source === "live", asOf, loading };
}

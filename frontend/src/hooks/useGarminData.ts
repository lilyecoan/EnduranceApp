"use client";
import { useState, useEffect } from "react";
import { fetchGarminSnapshot, type GarminSnapshot } from "@/lib/garminApi";
import { mockGarminData } from "@/lib/mockData";

const REFRESH_MS = 5 * 60 * 1000; // refresh every 5 minutes

export function useGarminData() {
  const [data, setData]     = useState<GarminSnapshot>(mockGarminData);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const snapshot = await fetchGarminSnapshot();
        if (!cancelled) {
          setData(snapshot);
          setIsLive(true);
        }
      } catch {
        // backend down — keep showing mockData, no crash
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { data, isLive, loading };
}

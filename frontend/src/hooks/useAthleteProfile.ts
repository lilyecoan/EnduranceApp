"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchProfile, updateProfile, type AthleteProfile } from "@/lib/profileApi";

export function useAthleteProfile() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      const result = await fetchProfile(token);
      if (cancelled) return;
      setProfile(result);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const reload = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const result = await fetchProfile(token);
    setProfile(result);
    setLoading(false);
  }, [getToken]);

  const save = useCallback(
    async (updates: Partial<AthleteProfile>) => {
      const token = await getToken();
      const result = await updateProfile(token, updates);
      if (result) setProfile(result);
      return result;
    },
    [getToken]
  );

  return { profile, loading, reload, save };
}

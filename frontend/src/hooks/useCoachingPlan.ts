"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { runCoachingPipeline, type CoachingPlan } from "@/lib/coachingApi";

/**
 * Today's coaching plan. The server reuses today's result until the athlete's
 * data changes, so calling this from several pages is cheap. `refreshKey`:
 * change it to re-check after new data (e.g. a check-in); `refresh()` forces
 * a fresh AI run.
 */
export function useCoachingPlan(refreshKey = 0) {
  const { getToken } = useAuth();
  const [plan, setPlan] = useState<CoachingPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      const result = await runCoachingPipeline(token);
      if (cancelled) return;
      setPlan(result.plan);
      setErrors(result.errors);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, refreshKey]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await runCoachingPipeline(await getToken(), { force: true });
    setPlan(result.plan);
    setErrors(result.errors);
    setRefreshing(false);
  }, [getToken]);

  return { plan, errors, loading, refresh, refreshing };
}

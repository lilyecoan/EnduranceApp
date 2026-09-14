"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { runCoachingPipeline, type CoachingPlan } from "@/lib/coachingApi";

export function useCoachingPlan() {
  const { getToken } = useAuth();
  const [plan, setPlan] = useState<CoachingPlan | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [getToken]);

  return { plan, errors, loading };
}

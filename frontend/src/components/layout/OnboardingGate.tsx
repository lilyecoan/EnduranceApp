"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchProfile } from "@/lib/profileApi";

/**
 * Sends athletes who haven't finished (or skipped) first-run onboarding to
 * /onboarding. If the profile can't be loaded, it does nothing rather than
 * trapping the athlete in a redirect loop.
 */
export function OnboardingGate() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      const profile = await fetchProfile(await getToken());
      if (!cancelled && profile && !profile.onboarding_completed) router.replace("/onboarding");
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  return null;
}

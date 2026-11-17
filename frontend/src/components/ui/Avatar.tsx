"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

/** Initials avatar with lime ring (Figma "Avatar"); links to the profile. */
export function Avatar({ size = 44 }: { size?: number }) {
  const { user } = useUser();
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";
  return (
    <Link
      href="/profile"
      aria-label="Athlete profile"
      className="bg-surface2 border border-lime rounded-full flex items-center justify-center shrink-0 text-lime font-semibold"
      style={{ width: size, height: size, fontSize: size >= 48 ? 15 : 14 }}
    >
      {initials}
    </Link>
  );
}

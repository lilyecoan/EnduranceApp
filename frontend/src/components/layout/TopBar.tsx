"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { Avatar } from "@/components/ui/Avatar";

// Search jumps to the page that holds what was typed.
const DESTINATIONS: { href: string; words: string[] }[] = [
  { href: "/plan", words: ["plan", "session", "workout", "training", "log", "load", "week"] },
  { href: "/nutrition", words: ["fuel", "nutrition", "food", "meal", "carb", "diet", "protein"] },
  { href: "/race", words: ["race", "strategy", "timeline", "pacing", "weather", "course", "gel"] },
  { href: "/recovery", words: ["recovery", "sleep", "hrv", "rest", "readiness", "heart"] },
  { href: "/profile", words: ["profile", "ftp", "pace", "weight", "injur", "medical", "goal", "gym"] },
  { href: "/settings", words: ["setting", "garmin", "apple", "health", "strava", "intervals", "upload", "unit", "data"] },
  { href: "/", words: ["home", "overview", "coach", "check-in", "checkin", "today"] },
];

/** Desktop page header (Figma: Race Strategy — Desktop / Top Bar). */
export function TopBar({ label, title }: { label: string; title: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [miss, setMiss] = useState(false);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = DESTINATIONS.find((d) => d.words.some((w) => q.includes(w) || w.startsWith(q)));
    if (hit) {
      setQuery("");
      router.push(hit.href);
    } else {
      setMiss(true);
    }
  }

  return (
    <div className="hidden lg:flex items-center justify-between gap-6 w-full">
      <div className="flex flex-col gap-1.5 min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <h1 className="text-[30px] font-semibold text-fg tracking-[-0.9px] truncate">{title}</h1>
      </div>
      <div className="flex gap-2.5 items-center shrink-0">
        <form onSubmit={search} role="search" className="relative">
          <label className="bg-surface flex gap-2.5 items-center px-[18px] py-3 rounded-full">
            <FigmaIcon name="icon-search.svg" size={16} original />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMiss(false);
              }}
              placeholder="Search plan, fuel, sessions…"
              aria-label="Search the app"
              className="bg-transparent text-sm text-fg placeholder:text-muted outline-none w-[210px]"
            />
          </label>
          {miss && <p className="absolute right-4 top-full mt-1 text-[11px] text-muted">No match. Try “fuel” or “sleep”.</p>}
        </form>
        <Link href="/#check-in" aria-label="Daily check-in" className="bg-surface rounded-full size-11 flex items-center justify-center">
          <FigmaIcon name="icon-bell.svg" size={19.8} original />
        </Link>
        <Avatar size={44} />
      </div>
    </div>
  );
}

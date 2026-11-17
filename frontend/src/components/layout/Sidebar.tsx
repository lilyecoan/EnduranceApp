"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { useAthleteProfile } from "@/hooks/useAthleteProfile";
import { daysUntil } from "@/lib/utils";
import { goalLabel } from "@/lib/raceTypes";
import { buildProgress } from "@/lib/raceProgress";
import { NAV, SETTINGS, isActive } from "@/components/layout/nav";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** Desktop sidebar (Figma: Race Strategy — Desktop / Sidebar). Hidden below lg. */
export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { profile } = useAthleteProfile();

  const name = user?.fullName || profile?.full_name || "Athlete";
  const raceDate = profile?.primary_race_date;
  const days = raceDate ? daysUntil(raceDate) : null;
  const progress = buildProgress(days);
  const goal = profile?.training_goal || profile?.primary_race_distance;

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[272px] bg-side border-r border-stroke flex-col gap-7 px-5 py-7 z-50 overflow-y-auto">
      <Link href="/" className="flex gap-3 items-center px-2">
        <div className="bg-lime rounded-[13px] size-[42px] flex items-center justify-center text-ink">
          <FigmaIcon name="icon-chev.svg" size={18.9} original />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-extrabold text-fg tracking-[1.28px]">IRONMIND</span>
          <span className="text-[10px] font-semibold text-lime tracking-[2.2px]">AI COACH</span>
        </div>
      </Link>

      <div className="bg-surface border border-stroke rounded-[24px] p-4 flex flex-col gap-4 w-full">
        <div className="flex gap-3 items-center w-full">
          <div className="bg-surface2 border border-lime rounded-full size-11 flex items-center justify-center text-sm font-semibold text-lime shrink-0">
            {initials(name)}
          </div>
          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <span className="text-[15px] font-semibold text-fg truncate">{name}</span>
            <span className="text-xs text-muted truncate">{goal ? goalLabel(goal) : "No goal set"}</span>
          </div>
          {days !== null && days >= 0 && (
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-lime tracking-[-0.4px]">{days}</span>
              <span className="text-[9px] font-semibold text-muted tracking-[1.08px]">DAYS</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex justify-between gap-2 text-[10px] font-medium text-muted">
            <span className="tracking-[0.8px] uppercase truncate">{profile?.primary_race_name || "No race set"}</span>
            {raceDate && (
              <span className="shrink-0">
                {new Date(raceDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <div className="bg-surface2 h-1.5 rounded overflow-hidden w-full">
            <div className="bg-lime h-1.5" style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }} />
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 w-full">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex gap-3.5 items-center px-4 py-[13px] rounded-full text-[15px] transition-colors ${
                active ? "bg-lime text-ink font-semibold" : "text-muted font-medium hover:text-fg hover:bg-surface"
              }`}
            >
              <FigmaIcon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 min-h-4" />

      <div className="bg-surface border border-lime rounded-[24px] p-[18px] flex flex-col gap-3 w-full">
        <div className="flex gap-2 items-center">
          <FigmaIcon name="icon-sparkle-lime.svg" size={18} original />
          <span className="text-sm font-semibold text-fg">Ask your AI coach</span>
        </div>
        <p className="text-xs leading-[1.45] text-muted">
          “How should I adjust fueling if it’s hotter than forecast?”
        </p>
        <Link href="/" className="bg-lime rounded-full px-3.5 py-2.5 text-center text-[13px] font-semibold text-ink hover:bg-lime/90">
          See today&apos;s coaching
        </Link>
      </div>

      <div className="flex flex-col gap-1 w-full -mt-3">
        <Link
          href={SETTINGS.href}
          className={`flex gap-3.5 items-center px-4 py-2.5 rounded-full text-[15px] font-medium ${
            isActive(pathname, SETTINGS.href) ? "bg-lime text-ink" : "text-muted hover:text-fg"
          }`}
        >
          <FigmaIcon name={SETTINGS.icon} size={20} />
          Settings
        </Link>
        <SignOutButton>
          <button className="flex gap-3.5 items-center px-4 py-2.5 rounded-full text-[15px] font-medium text-muted hover:text-fg">
            <LogOut className="size-5" strokeWidth={1.5} /> Sign out
          </button>
        </SignOutButton>
      </div>
      <p className="text-[10px] font-medium text-muted tracking-[1.2px] -mt-4 px-2">ANYTHING IS POSSIBLE®</p>
    </aside>
  );
}

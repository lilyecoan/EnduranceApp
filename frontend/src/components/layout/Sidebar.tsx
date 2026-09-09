"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Calendar, Utensils, Heart, Trophy, User, Settings,
} from "lucide-react";
import { daysUntil } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/plan", label: "Training Plan", icon: Calendar },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/recovery", label: "Recovery", icon: Heart },
  { href: "/race", label: "Race Strategy", icon: Trophy },
  { href: "/profile", label: "Athlete Profile", icon: User },
];

const medals = ["T1D", "Celiac", "Hashimoto's", "RA"];

export function Sidebar() {
  const pathname = usePathname();
  const days = daysUntil("2027-04-04");

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[#080808] border-r border-[#1e1e1e] flex flex-col z-50">

      {/* Ironman Logo */}
      <div className="px-5 py-5 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-3">
          {/* M-dot icon */}
          <div className="w-9 h-9 rounded-lg bg-[#CE0E2D] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#CE0E2D]/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 2L2 19h4l6-10 6 10h4L12 2z"/>
            </svg>
          </div>
          <div>
            <div className="font-black text-white text-sm tracking-wider uppercase">IronMind</div>
            <div className="text-[10px] text-[#CE0E2D] font-bold tracking-[0.2em] uppercase">AI Coach</div>
          </div>
        </div>
      </div>

      {/* Athlete card */}
      <div className="px-4 py-3 border-b border-[#1e1e1e]">
        <div className="rounded-xl overflow-hidden">
          {/* Red header strip */}
          <div className="bg-[#CE0E2D] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-black text-white">
                LC
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-none">Lily Coan</div>
                <div className="text-[9px] text-white/70 leading-none mt-0.5">IM 70.3 Athlete</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-white leading-none">{days}</div>
              <div className="text-[8px] text-white/70 leading-none">DAYS</div>
            </div>
          </div>
          {/* Dark body */}
          <div className="bg-[#111] px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-[#737373] uppercase tracking-widest">Galveston 70.3</span>
              <span className="text-[9px] text-[#737373]">Mar 20, 2027</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {medals.map((c) => (
                <span key={c} className="text-[8px] px-1.5 py-0.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#737373]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#CE0E2D]/10 text-white border border-[#CE0E2D]/30"
                  : "text-[#737373] hover:text-white hover:bg-[#1a1a1a]"
              )}
            >
              <Icon
                className={cn("w-4 h-4 flex-shrink-0", active ? "text-[#CE0E2D]" : "")}
              />
              <span className={active ? "font-semibold" : ""}>{label}</span>
              {active && <div className="ml-auto w-1 h-4 rounded-full bg-[#CE0E2D]" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#1e1e1e]">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#737373] hover:text-white hover:bg-[#1a1a1a] transition-all"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <div className="px-3 pt-3 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#CE0E2D] pulse-red" />
          <span className="text-[10px] text-[#737373]">Garmin + Gemini · Live</span>
        </div>
        <div className="px-3 pt-2">
          <p className="text-[9px] text-[#404040] font-medium uppercase tracking-widest">
            Anything is Possible®
          </p>
        </div>
      </div>
    </aside>
  );
}

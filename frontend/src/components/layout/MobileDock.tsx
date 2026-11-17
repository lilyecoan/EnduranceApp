"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { MOBILE_TABS, isActive } from "@/components/layout/nav";

/** Mobile bottom dock (Figma "Bottom Dock" 1:228), pinned on every screen below lg. */
export function MobileDock() {
  const pathname = usePathname();
  return (
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[362px] max-w-[calc(100%-32px)] flex flex-col gap-2.5">
      <Link
        href="/race#timeline"
        className="bg-lime flex gap-3 items-center pl-1.5 pr-5 py-1.5 rounded-full w-full shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
      >
        <span className="bg-ink rounded-full size-[50px] flex items-center justify-center shrink-0">
          <FigmaIcon name="dock-bike.svg" size={22.5} original />
        </span>
        <span className="flex-1 min-w-0 text-[15px] font-semibold text-ink">Open race-day plan</span>
        <span className="text-xl font-bold text-ink tracking-[2px]" aria-hidden>›››</span>
      </Link>
      <nav
        aria-label="Main"
        className="backdrop-blur-[12px] bg-surface/95 border border-stroke flex items-center justify-between px-2.5 py-2 rounded-full w-full"
      >
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col gap-1 items-center px-3.5 py-2 rounded-full ${active ? "bg-lime text-ink" : "text-muted"}`}
            >
              <FigmaIcon name={tab.icon} size={20} />
              <span className="text-[10px] font-medium">{tab.short}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

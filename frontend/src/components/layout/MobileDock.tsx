"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { MOBILE_TABS, isActive } from "@/components/layout/nav";

/** Mobile tab bar (Figma "Tab Bar", from the Bottom Dock), pinned below lg. */
export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[362px] max-w-[calc(100%-32px)] backdrop-blur-[12px] bg-surface/95 border border-stroke flex items-center justify-between px-2.5 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
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
  );
}

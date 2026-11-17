"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { LogOut, X } from "lucide-react";
import { FigmaIcon } from "@/components/ui/FigmaIcon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV, SETTINGS, isActive } from "@/components/layout/nav";

/** Mobile top bar (Figma: Race Strategy — Mobile / Header); the dots button opens the full menu. */
export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-5 pt-4">
        <button
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="bg-white rounded-full size-12 flex items-center justify-center"
        >
          <FigmaIcon name="icon-dots.svg" size={21.6} original />
        </button>
        <div className="flex gap-2.5 items-center">
          <Link href="/#check-in" aria-label="Daily check-in" className="bg-surface rounded-full size-12 flex items-center justify-center">
            <FigmaIcon name="icon-bell-mobile.svg" size={21.6} original />
          </Link>
          <Avatar size={48} />
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav
            aria-label="All pages"
            className="absolute left-4 right-4 top-4 bg-side border border-stroke rounded-[28px] p-4 flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-base font-extrabold text-fg tracking-[1.28px]">IRONMIND</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="size-10 rounded-full bg-surface flex items-center justify-center text-muted">
                <X className="size-5" />
              </button>
            </div>
            {[...NAV, SETTINGS].map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex gap-3.5 items-center px-4 py-[13px] rounded-full text-[15px] ${
                    active ? "bg-lime text-ink font-semibold" : "text-muted font-medium"
                  }`}
                >
                  <FigmaIcon name={item.icon} size={20} />
                  {item.label}
                </Link>
              );
            })}
            <SignOutButton>
              <button className="flex gap-3.5 items-center px-4 py-[13px] rounded-full text-[15px] font-medium text-muted">
                <LogOut className="size-5" strokeWidth={1.5} /> Sign out
              </button>
            </SignOutButton>
          </nav>
        </div>
      )}
    </>
  );
}

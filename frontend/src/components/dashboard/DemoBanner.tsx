import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface DemoBannerProps {
  message?: string;
  className?: string;
}

export function DemoBanner({
  message = "Showing demo data — not from a connected live source.",
  className,
}: DemoBannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-[#d97706]/25 bg-[#d97706]/5 px-3.5 py-2 text-xs font-medium text-[#fbbf24]",
        className
      )}
    >
      <Info className="w-3.5 h-3.5 shrink-0" />
      {message}
    </div>
  );
}

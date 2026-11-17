import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  highlight?: "success" | "warning" | "danger" | "red" | "default";
  className?: string;
}

const styles = {
  default: { card: "border-stroke bg-surface", icon: "bg-surface2 text-muted", value: "text-white" },
  success: { card: "border-[#16a34a]/25 bg-[#16a34a]/5", icon: "bg-[#16a34a]/15 text-[#16a34a]", value: "text-[#4ade80]" },
  warning: { card: "border-[#d97706]/25 bg-[#d97706]/5", icon: "bg-[#d97706]/15 text-[#d97706]", value: "text-[#fbbf24]" },
  danger: { card: "border-[#f87171]/25 bg-[#f87171]/5", icon: "bg-[#f87171]/15 text-[#f87171]", value: "text-[#f87171]" },
  red: { card: "border-lime/25 bg-lime/5", icon: "bg-lime/15 text-lime", value: "text-fg" },
};

export function StatCard({
  label,
  value,
  unit,
  subtext,
  icon: Icon,
  trend,
  trendValue,
  highlight = "default",
  className,
}: StatCardProps) {
  const s = styles[highlight] ?? styles.default;

  return (
    <div className={cn("rounded-[24px] border p-4 transition-all hover:border-muted", s.card, className)}>
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[10px] font-bold text-muted uppercase tracking-[0.12em]">{label}</span>
        {Icon && (
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", s.icon)}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className={cn("text-2xl font-semibold tabular-nums", s.value)}>{value}</span>
        {unit && <span className="text-xs text-muted mb-0.5 font-medium">{unit}</span>}
      </div>
      {(subtext || trendValue) && (
        <div className="flex items-center gap-2 mt-1.5">
          {trendValue && (
            <span className={cn(
              "text-[10px] font-semibold",
              trend === "up" ? "text-[#4ade80]" : trend === "down" ? "text-lime" : "text-muted"
            )}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </span>
          )}
          {subtext && <span className="text-[10px] text-muted">{subtext}</span>}
        </div>
      )}
    </div>
  );
}

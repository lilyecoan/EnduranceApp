import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";

interface CoachCardProps {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "alert";
  metrics?: { label: string; value: string }[];
  confidence?: number;
  agentSource?: string;
  className?: string;
}

const styles = {
  info: {
    card: "border-[#CE0E2D]/20 bg-[#CE0E2D]/5",
    icon: Info,
    iconBg: "bg-[#CE0E2D]/15",
    iconColor: "text-[#CE0E2D]",
    badge: "bg-[#CE0E2D]/10 text-[#CE0E2D] border border-[#CE0E2D]/20",
    bar: "from-[#CE0E2D] to-[#E31837]",
  },
  success: {
    card: "border-[#16a34a]/20 bg-[#16a34a]/5",
    icon: CheckCircle,
    iconBg: "bg-[#16a34a]/15",
    iconColor: "text-[#4ade80]",
    badge: "bg-[#16a34a]/10 text-[#4ade80] border border-[#16a34a]/20",
    bar: "from-[#16a34a] to-[#4ade80]",
  },
  warning: {
    card: "border-[#d97706]/20 bg-[#d97706]/5",
    icon: AlertTriangle,
    iconBg: "bg-[#d97706]/15",
    iconColor: "text-[#fbbf24]",
    badge: "bg-[#d97706]/10 text-[#fbbf24] border border-[#d97706]/20",
    bar: "from-[#d97706] to-[#fbbf24]",
  },
  alert: {
    card: "border-[#CE0E2D]/30 bg-[#CE0E2D]/8",
    icon: AlertTriangle,
    iconBg: "bg-[#CE0E2D]/20",
    iconColor: "text-[#CE0E2D]",
    badge: "bg-[#CE0E2D]/15 text-[#CE0E2D] border border-[#CE0E2D]/30",
    bar: "from-[#CE0E2D] to-[#9B0A21]",
  },
};

export function CoachCard({
  title,
  message,
  type = "info",
  metrics,
  confidence,
  agentSource,
  className,
}: CoachCardProps) {
  const s = styles[type];
  const Icon = s.icon;

  return (
    <div className={cn("rounded-xl border p-4", s.card, className)}>
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", s.iconBg)}>
          <Icon className={cn("w-4 h-4", s.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {agentSource && (
              <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0", s.badge)}>
                {agentSource}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#a3a3a3] leading-relaxed">{message}</p>
          {metrics && metrics.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#ffffff]/5">
              {metrics.map((m) => (
                <div key={m.label}>
                  <div className="text-[9px] text-[#525252] uppercase tracking-wider">{m.label}</div>
                  <div className="text-xs font-bold text-white mt-0.5">{m.value}</div>
                </div>
              ))}
            </div>
          )}
          {confidence !== undefined && (
            <div className="flex items-center gap-2 mt-2.5">
              <Zap className="w-3 h-3 text-[#404040]" />
              <span className="text-[10px] text-[#525252]">Confidence {Math.round(confidence * 100)}%</span>
              <div className="flex-1 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className={cn("h-full bg-gradient-to-r rounded-full", s.bar)}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

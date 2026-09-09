"use client";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({ score, label, size = 100, strokeWidth = 7, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const gap = circumference - progress;

  const color =
    score >= 85 ? "#CE0E2D" :
    score >= 70 ? "#16a34a" :
    score >= 55 ? "#d97706" :
    "#525252";

  const textColor =
    score >= 85 ? "#f87171" :
    score >= 70 ? "#4ade80" :
    score >= 55 ? "#fbbf24" :
    "#737373";

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e1e1e" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${progress} ${gap}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-xl font-black tabular-nums", textColor)}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-[#525252] font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );
}

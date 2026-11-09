import { ExternalLink, HeartPulse } from "lucide-react";
import type { HealthSource } from "@/lib/coachingApi";

type Props = {
  adjustments: string[];
  sources: HealthSource[];
  className?: string;
};

/** Plan changes made for the athlete's conditions, injuries and diet, with the sources consulted. */
export function HealthCard({ adjustments, sources, className = "" }: Props) {
  if (adjustments.length === 0 && sources.length === 0) return null;
  const uniqueSources = sources.filter((s, i) => sources.findIndex((o) => o.url === s.url) === i);

  return (
    <div className={`rounded-xl border border-[#1e1e1e] bg-[#111] p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <HeartPulse className="w-4 h-4 text-[#f472b6]" />
        <h3 className="text-sm font-black text-white">Health considerations</h3>
        <span className="text-[10px] text-[#525252]">based on what you told us</span>
      </div>
      {adjustments.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {adjustments.map((a, i) => (
            <li key={i} className="flex gap-2 text-xs text-[#d4d4d4]">
              <span className="text-[#f472b6]">•</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
      {uniqueSources.length > 0 && (
        <div className="border-t border-[#1e1e1e] pt-2">
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-1.5">Sources</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {uniqueSources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-[#60a5fa] hover:underline inline-flex items-center gap-1">
                {s.name} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] text-[#404040] mt-2">
        General training guidance, not medical advice. If something is getting worse, check with a clinician.
      </p>
    </div>
  );
}

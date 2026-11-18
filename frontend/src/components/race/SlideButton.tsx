import { FigmaIcon } from "@/components/ui/FigmaIcon";

/** Figma "Slide Button" (1:229): lime pill that jumps to the race-day timeline. */
export function SlideButton({ href = "#timeline", className = "" }: { href?: string; className?: string }) {
  return (
    <a href={href} className={`bg-lime flex gap-3 items-center pl-1.5 pr-5 py-1.5 rounded-full w-full ${className}`}>
      <span className="bg-ink rounded-full size-[50px] flex items-center justify-center shrink-0">
        <FigmaIcon name="dock-bike.svg" size={22.5} original />
      </span>
      <span className="flex-1 min-w-0 text-[15px] font-semibold text-ink">Open race-day plan</span>
      <span className="text-xl font-bold text-ink tracking-[2px]" aria-hidden>›››</span>
    </a>
  );
}

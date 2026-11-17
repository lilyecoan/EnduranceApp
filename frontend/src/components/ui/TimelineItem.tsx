import { FigmaIcon } from "@/components/ui/FigmaIcon";

type Props = {
  meta: string;
  title: string;
  detail: string;
  amount?: string | null;
  /** Hide the rail line below the last item. */
  last?: boolean;
};

/** Figma "Timeline Item": rail, meta line, title, detail and optional amount chip. */
export function TimelineItem({ meta, title, detail, amount, last = false }: Props) {
  return (
    <div className="flex gap-3 items-start w-full">
      <div className="flex flex-col gap-1.5 items-center pt-1 self-stretch shrink-0">
        <FigmaIcon name="dot.svg" size={10} original />
        {!last && <div className="bg-stroke flex-1 min-h-px w-[2px]" />}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 items-start min-w-0 pb-[18px]">
        <p className="text-[11px] font-semibold text-lime tracking-[0.66px] uppercase">{meta}</p>
        <p className="text-base font-semibold text-fg">{title}</p>
        <p className="text-[13px] leading-[1.45] text-muted">{detail}</p>
        {amount && (
          <span className="bg-surface2 px-2.5 py-1.5 rounded-full text-xs font-medium text-fg">{amount}</span>
        )}
      </div>
    </div>
  );
}

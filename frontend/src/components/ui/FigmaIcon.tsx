import type { CSSProperties } from "react";

type Props = {
  /** File name in /public/figma, e.g. "icon-grid.svg". */
  name: string;
  size: number;
  className?: string;
  /** Use the SVG's own colors (as drawn in Figma) instead of the text color. */
  original?: boolean;
};

/**
 * An icon exported from the IronMind Figma file. By default the SVG is used as
 * a mask so it takes the current text color (active/inactive nav states);
 * `original` renders it as drawn.
 */
export function FigmaIcon({ name, size, className = "", original = false }: Props) {
  const src = `/figma/${name}`;
  if (original) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={`figma-icon ${className}`}
      style={{ width: size, height: size, "--icon": `url(${src})` } as CSSProperties}
    />
  );
}

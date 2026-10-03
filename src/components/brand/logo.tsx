import { cn } from "cn";
import { DOT, SPEED_LINES, SWASH, WORDMARK } from "./logo-paths";

type Props = {
  className?: string;
  /** "dark" = navy ink for light backgrounds; "light" = cream ink for navy backgrounds */
  tone?: "dark" | "light";
  /** include the speed lines (hero / footer) */
  speed?: boolean;
  title?: string;
};

/** The 13C wordmark: italic 1-3-C, red dot and the key-blade swash. */
export function Logo({ className, tone = "dark", speed = false, title = "13C" }: Props) {
  const ink = tone === "dark" ? "var(--navy-900)" : "var(--cream)";
  return (
    <svg
      viewBox={speed ? "-700 -170 1100 340" : "-370 -170 770 340"}
      className={cn("h-7 w-auto", className)}
      role="img"
      aria-label={title}
    >
      {speed && (
        <g>
          {SPEED_LINES.map((s) => (
            <rect key={s.y} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.h / 2} fill={s.accent ? "var(--brand-red)" : ink} />
          ))}
        </g>
      )}
      <path d={WORDMARK} fill={ink} />
      <circle {...DOT} fill="var(--brand-red)" />
      <path d={SWASH} fill="var(--brand-red)" />
    </svg>
  );
}

/** Square app mark for avatars/icons. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-grid size-9 place-items-center rounded-xl bg-navy-900", className)}>
      <Logo tone="light" className="h-[55%]" />
    </span>
  );
}

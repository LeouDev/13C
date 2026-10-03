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

/** Full badge: ring + circular "CAR RENTAL • DRIVE ANYWHERE" text around the wordmark (as in the brand logo). */
export function LogoBadge({ className, spin = true }: { className?: string; spin?: boolean }) {
  const text = "CAR RENTAL • DRIVE ANYWHERE • CAR RENTAL • DRIVE ANYWHERE • ";
  return (
    <svg viewBox="-720 -470 1200 940" className={className} role="img" aria-label="13C — Car rental, drive anywhere">
      <defs>
        <path id="badge-path" d="M 0,-388 A 388 388 0 1 1 -0.01,-388" />
      </defs>
      <circle r="420" fill="none" stroke="var(--cream)" strokeWidth="6" />
      <circle r="356" fill="none" stroke="var(--cream)" strokeWidth="2" opacity="0.45" />
      {/* rotate about the ring's centre (0,0 in user space), not the viewBox centre */}
      <g className={spin ? "animate-[spin_60s_linear_infinite] motion-reduce:animate-none" : undefined} style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <text fill="var(--cream)" fontSize="34" letterSpacing="8" style={{ fontFamily: "var(--font-barlow)", fontWeight: 600 }}>
          <textPath href="#badge-path" textLength={2 * Math.PI * 388 * 0.985} lengthAdjust="spacing">{text}</textPath>
        </text>
      </g>
      <rect x="-600" y="-118" width="282" height="208" fill="var(--navy-900)" />
      {SPEED_LINES.map((s) => (
        <rect key={s.y} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.h / 2} fill={s.accent ? "var(--brand-red)" : "var(--cream)"} />
      ))}
      <path d={WORDMARK} fill="var(--cream)" />
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

import { cn } from "cn";

// [x, y, width, height, red?] — motion lines trailing the car
const TRAIL = [[-120, 30, 90, 5, true], [-90, 44, 70, 4, false], [-125, 56, 100, 6, false], [-80, 66, 55, 4, true]] as const;

function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={70} r={17} fill="var(--navy-950)" stroke="var(--cream)" strokeWidth={4} />
      <g className="animate-[spin_0.35s_linear_infinite] motion-reduce:animate-none" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <rect x={cx - 1.5} y={58} width={3} height={24} fill="var(--cream)" />
        <rect x={cx - 12} y={68.5} width={24} height={3} fill="var(--cream)" />
      </g>
    </g>
  );
}

/** Flat cream car for the brand panel: drives in, idles (bob + spinning wheels), speeds off, loops. Pure CSS. */
export function DriveCar({ className }: { className?: string }) {
  return (
    <div className="animate-drive" aria-hidden>
      <svg viewBox="-130 0 370 92" className={cn("block h-auto overflow-visible", className)}>
        <g className="animate-bob">
          {TRAIL.map(([x, y, w, h, red]) => (
            <rect key={y} x={x} y={y} width={w} height={h} rx={h / 2} fill={red ? "var(--brand-red)" : "var(--cream)"} opacity={red ? 1 : 0.6} />
          ))}
          <path d="M10 60Q10 44 26 42L70 38L100 16Q106 12 114 12L160 12Q170 12 176 18L200 40L222 44Q232 46 232 56L232 66Q232 70 228 70L14 70Q10 70 10 66Z" fill="var(--cream)" />
          <path d="M106 20L150 20L150 38L82 38Z" fill="var(--navy-900)" />
          <path d="M156 20L168 20Q172 20 175 24L188 38L156 38Z" fill="var(--navy-900)" />
          <rect x={20} y={50} width={204} height={4} fill="var(--brand-red)" />
          <rect x={10} y={46} width={6} height={8} rx={2} fill="var(--brand-red)" />
          <rect x={224} y={48} width={8} height={6} rx={2} className="fill-amber-200" />
        </g>
        <Wheel cx={62} />
        <Wheel cx={186} />
      </svg>
    </div>
  );
}

/** Seeded LCG, so every render (server or client) produces the same streaks. */
function streaksFor(count: number, seed: number, top: number, bottom: number) {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: count }, () => {
    const dur = 1.6 + rand() * 2.4;
    return { top: top + rand() * (bottom - top), width: 12 + rand() * 28, height: 1 + Math.floor(rand() * 4), red: rand() < 0.3, dur, delay: -rand() * dur };
  });
}

/** Thin streaks that keep passing across the brand panel, right to left, within a top–bottom band (%). Pure CSS, no client JS. */
export function SpeedStreaks({ count, seed = 13, top = 4, bottom = 96 }: { count: number; seed?: number; top?: number; bottom?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {streaksFor(count, seed, top, bottom).map((t, i) => (
        <span
          key={i}
          className="animate-streak absolute rounded"
          style={{
            top: `${t.top.toFixed(2)}%`,
            width: `${t.width.toFixed(2)}%`,
            height: t.height,
            background: `linear-gradient(90deg, ${t.red ? "var(--brand-red)" : "color-mix(in srgb, var(--cream) 55%, transparent)"}, transparent)`,
            "--dur": `${t.dur.toFixed(2)}s`,
            "--delay": `${t.delay.toFixed(2)}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

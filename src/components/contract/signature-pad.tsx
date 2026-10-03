"use client";

import { Caveat } from "next/font/google";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { cn } from "cn";

// Self-hosted by next/font; used to draw typed signatures onto the canvas.
const caveat = Caveat({ subsets: ["latin"], weight: "600", display: "block" });

export type SignaturePadHandle = { toDataURL: () => string | null; mode: "DRAWN" | "TYPED" };

const W = 560;
const H = 160;

/**
 * One pad for both signers. Draw (pointer events) or Type (name rendered in a handwriting font);
 * either way the result is a PNG from the same canvas, so the server always receives an image.
 */
export function SignaturePad({ ref, name, onChange }: { ref?: React.Ref<SignaturePadHandle>; name: string; onChange?: (inked: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"DRAWN" | "TYPED">("TYPED");
  const [inked, setInked] = useState(false);
  const mark = useCallback((v: boolean) => { setInked(v); onChange?.(v); }, [onChange]);

  const ctx = useCallback(() => canvas.current!.getContext("2d")!, []);
  const clear = useCallback(() => {
    const c = canvas.current!;
    ctx().clearRect(0, 0, c.width, c.height);
  }, [ctx]);

  // Size the backing store once: crisp at max(2, devicePixelRatio).
  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.max(2, window.devicePixelRatio || 1);
    c.width = W * ratio;
    c.height = H * ratio;
    const g = ctx();
    g.scale(ratio, ratio);
    g.lineWidth = 2.4;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = g.fillStyle = "#121f3b";
  }, [ctx]);

  // Type mode: render the name, shrinking the font until it fits.
  useEffect(() => {
    if (mode !== "TYPED") return;
    let live = true;
    const family = caveat.style.fontFamily;
    document.fonts.load(`600 72px ${family}`).then(() => {
      if (!live) return;
      clear();
      const text = name.trim();
      if (text.length < 2) return mark(false);
      const g = ctx();
      let size = 72;
      do { g.font = `600 ${size}px ${family}`; size -= 2; } while (size > 18 && g.measureText(text).width > W - 48);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, W / 2, H / 2 + 4);
      mark(true);
    });
    return () => { live = false; };
  }, [mode, name, clear, ctx, mark]);

  useImperativeHandle(ref, () => ({ toDataURL: () => (inked ? canvas.current!.toDataURL("image/png") : null), mode }), [inked, mode]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <div className="flex rounded-full bg-canvas p-1" role="tablist" aria-label="Signature method">
          {([["TYPED", "Type", Type], ["DRAWN", "Draw", PenLine]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m}
              onClick={() => { setMode(m); clear(); mark(false); }}
              className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold", mode === m ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {mode === "DRAWN" && (
          <button type="button" onClick={() => { clear(); mark(false); }} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium hover:bg-slate-200">
            <Eraser className="size-3.5" /> Clear
          </button>
        )}
      </div>
      <div className="relative">
        <canvas
          ref={canvas}
          className={cn("aspect-[560/160] w-full max-w-[560px] touch-none rounded-2xl border-2 border-dashed border-input bg-white", mode === "DRAWN" ? "cursor-crosshair" : "pointer-events-none")}
          aria-label={mode === "DRAWN" ? "Signature area — draw your signature" : `Typed signature: ${name}`}
          onPointerDown={(e) => {
            if (mode !== "DRAWN") return;
            drawing.current = true;
            canvas.current!.setPointerCapture(e.pointerId);
            const g = ctx();
            const p = pos(e);
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(p.x + 0.1, p.y + 0.1);
            g.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const p = pos(e);
            ctx().lineTo(p.x, p.y);
            ctx().stroke();
            if (!inked) mark(true);
          }}
          onPointerUp={() => { drawing.current = false; }}
          onPointerCancel={() => { drawing.current = false; }}
        />
        {mode === "DRAWN" && !inked && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sign here with your finger or mouse</span>}
        {mode === "TYPED" && !inked && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Type your full name above</span>}
      </div>
    </div>
  );
}

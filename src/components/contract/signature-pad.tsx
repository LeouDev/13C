"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export type SignaturePadHandle = { toDataURL: () => string | null; clear: () => void };

/** Pointer-based signature canvas (mouse, pen, touch). Exports a transparent PNG. */
export function SignaturePad({ ref, onChange }: { ref?: React.Ref<SignaturePadHandle>; onChange?: (empty: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#121f3b";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = useCallback(() => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(true);
  }, [onChange]);

  useImperativeHandle(ref, () => ({ toDataURL: () => (empty ? null : canvas.current!.toDataURL("image/png")), clear }), [empty, clear]);

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        className="h-44 w-full touch-none rounded-2xl border-2 border-dashed border-input bg-white"
        aria-label="Signature area — draw your signature"
        onPointerDown={(e) => {
          drawing.current = true;
          canvas.current!.setPointerCapture(e.pointerId);
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 0.1, p.y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (empty) { setEmpty(false); onChange?.(false); }
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sign here with your finger or mouse</span>}
      <span className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-slate-300" />
      <button type="button" onClick={clear} className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium hover:bg-slate-200">
        <Eraser className="size-3.5" /> Clear
      </button>
    </div>
  );
}

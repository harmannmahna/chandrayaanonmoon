import { useCallback, useMemo, useRef, useState } from "react";

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Original",
  afterLabel = "Enhanced",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clip = useMemo(() => `inset(0 ${100 - pos}% 0 0)`, [pos]);

  const updateFromClientX = useCallback((clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-[var(--border)] bg-black select-none"
      onPointerDown={(e) => {
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <img src={beforeSrc} alt={beforeLabel} className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale" draggable={false} />
      <img
        src={afterSrc}
        alt={afterLabel}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale"
        style={{ clipPath: clip }}
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]"
        style={{ left: `${pos}%`, transition: dragging ? "none" : "left 0.18s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <div
        className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/20 backdrop-blur-sm"
        style={{ left: `${pos}%`, transition: dragging ? "none" : "left 0.18s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <input
        aria-label="Compare before and after"
        className="absolute inset-0 cursor-ew-resize opacity-0"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
      />
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider">
        {afterLabel}
      </span>
    </div>
  );
}

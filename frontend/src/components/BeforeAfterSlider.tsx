import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";

const labelBase: CSSProperties = {
  pointerEvents: "none",
  position: "absolute",
  top: 12,
  zIndex: 20,
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  lineHeight: 1.2,
  boxShadow: "0 4px 14px rgba(0,0,0,0.55)",
  border: "1px solid rgba(255,255,255,0.35)",
};

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
    <div className="space-y-2">
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
        {/* Enhanced fills the frame — visible on the right of the handle */}
        <img src={afterSrc} alt={afterLabel} className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale" draggable={false} />
        {/* Original clipped to the left of the handle */}
        <img
          src={beforeSrc}
          alt={beforeLabel}
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

        {/* ORIGINAL — left side */}
        <span
          style={{
            ...labelBase,
            left: 12,
            color: "#ffffff",
            background: "#000000",
          }}
        >
          {beforeLabel}
        </span>

        {/* ENHANCED — right side (high-contrast yellow chip so it never blends into the moon) */}
        <span
          style={{
            ...labelBase,
            right: 12,
            color: "#0b1220",
            background: "#facc15",
            border: "1px solid rgba(0,0,0,0.35)",
          }}
        >
          {afterLabel}
        </span>
      </div>

      {/* Caption outside the dark image so labels are always readable */}
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em]">
        <span className="rounded-md bg-black px-2 py-1 text-white">{beforeLabel}</span>
        <span className="rounded-md bg-[#facc15] px-2 py-1 text-[#0b1220]">{afterLabel}</span>
      </div>
    </div>
  );
}

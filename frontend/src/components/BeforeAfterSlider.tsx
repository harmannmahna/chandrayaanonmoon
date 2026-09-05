import { useMemo, useRef, useState } from "react";

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
  const ref = useRef<HTMLDivElement>(null);
  const clip = useMemo(() => `inset(0 ${100 - pos}% 0 0)`, [pos]);

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-black"
      onPointerMove={(e) => {
        if (e.buttons !== 1 || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPos(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
      }}
    >
      <img src={beforeSrc} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover grayscale" />
      <img
        src={afterSrc}
        alt={afterLabel}
        className="absolute inset-0 h-full w-full object-cover grayscale"
        style={{ clipPath: clip }}
      />
      <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
      <input
        aria-label="Compare before and after"
        className="absolute inset-0 cursor-ew-resize opacity-0"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
      />
      <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider">
        {beforeLabel}
      </span>
      <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider">
        {afterLabel}
      </span>
    </div>
  );
}

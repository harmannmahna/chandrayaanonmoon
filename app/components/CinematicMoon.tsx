"use client";

import { useEffect, useRef } from "react";

/**
 * Original procedural moon (canvas) — not sourced from external prototypes.
 * Lit from upper-left for a cinematic disc with maria + craters.
 */
export function CinematicMoon({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 768;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Deterministic PRNG so the moon is stable across mounts.
    let seed = 0x4c554e41; // "LUNA"
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.48;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Base grey body with limb darkening
    const base = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r);
    base.addColorStop(0, "#efe8dc");
    base.addColorStop(0.28, "#cfc6b6");
    base.addColorStop(0.62, "#8f877a");
    base.addColorStop(1, "#2e2b27");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Soft maria (dark patches)
    for (let i = 0; i < 14; i++) {
      const mx = cx + (rand() - 0.48) * r * 1.35;
      const my = cy + (rand() - 0.5) * r * 1.35;
      const mr = r * (0.14 + rand() * 0.26);
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      g.addColorStop(0, `rgba(42, 40, 36, ${0.28 + rand() * 0.22})`);
      g.addColorStop(1, "rgba(42, 40, 36, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine grain / regolith
    const grain = ctx.getImageData(0, 0, size, size);
    const data = grain.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n * 0.94));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 0.86));
    }
    ctx.putImageData(grain, 0, 0);

    // Re-clip after putImageData (some browsers reset clip)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Craters — opaque bowls, not glass bubbles
    const craterCount = 42;
    for (let i = 0; i < craterCount; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * r * 0.86;
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      const cr = r * (0.01 + rand() * (i < 6 ? 0.075 : 0.035));

      ctx.beginPath();
      ctx.arc(x, y, cr, 0, Math.PI * 2);
      const bowl = ctx.createRadialGradient(x - cr * 0.2, y - cr * 0.25, cr * 0.15, x, y, cr);
      bowl.addColorStop(0, "rgba(210, 200, 185, 0.35)");
      bowl.addColorStop(0.55, "rgba(70, 65, 58, 0.35)");
      bowl.addColorStop(1, "rgba(25, 22, 18, 0.55)");
      ctx.fillStyle = bowl;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, cr * 0.96, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(20, 16, 12, 0.4)";
      ctx.lineWidth = Math.max(1, cr * 0.06);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, cr * 0.9, -2.5, -0.5);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = Math.max(1, cr * 0.05);
      ctx.stroke();
    }

    // Specular highlight
    const hi = ctx.createRadialGradient(
      cx - r * 0.34,
      cy - r * 0.4,
      0,
      cx - r * 0.08,
      cy - r * 0.08,
      r * 0.72,
    );
    hi.addColorStop(0, "rgba(255,255,255,0.18)");
    hi.addColorStop(0.4, "rgba(255,255,255,0.04)");
    hi.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, size, size);

    // Outer limb darkening
    const limb = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    limb.addColorStop(0, "rgba(0,0,0,0)");
    limb.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, []);

  return (
    <div className={`cinematic-moon ${className}`} aria-hidden="true">
      <div className="cinematic-moon__glow" />
      <canvas ref={canvasRef} className="cinematic-moon__disc" />
    </div>
  );
}

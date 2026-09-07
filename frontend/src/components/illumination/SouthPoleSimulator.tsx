import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../GlassCard";
import { generateSyntheticCraterTerrain } from "../../lib/illumination/craterTerrain";
import { accumulateIlluminationOverAzimuths, simulateCraterIllumination } from "../../lib/illumination/shadowMath";

export function SouthPoleSimulator() {
  const terrain = useMemo(() => generateSyntheticCraterTerrain(128, 128, 9001), []);
  const [elevation, setElevation] = useState(2);
  const [azimuth, setAzimuth] = useState(40);
  const [sweep, setSweep] = useState(false);
  const [accumulate, setAccumulate] = useState(true);
  const [showProxy, setShowProxy] = useState(true);
  const [showSolarAccess, setShowSolarAccess] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const acc = useMemo(
    () => (accumulate ? accumulateIlluminationOverAzimuths(terrain, elevation, 24) : null),
    [terrain, elevation, accumulate],
  );
  const single = useMemo(
    () => simulateCraterIllumination(terrain, { elevationDeg: elevation, azimuthDeg: azimuth }),
    [terrain, elevation, azimuth],
  );

  useEffect(() => {
    if (!sweep || accumulate) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setAzimuth((a) => (a + dt * 32) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sweep, accumulate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width: w, height: h } = terrain;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (accumulate && acc) {
        const v = acc[i]!;
        // never-lit = cool purple proxy; intermittent = blue; frequent = warm
        if (showProxy && v < 0.02) {
          img.data[o] = 70;
          img.data[o + 1] = 50;
          img.data[o + 2] = 140;
        } else if (showSolarAccess && v > 0.55) {
          img.data[o] = 255;
          img.data[o + 1] = 200;
          img.data[o + 2] = 90;
        } else {
          const g = Math.round(40 + v * 180);
          img.data[o] = g;
          img.data[o + 1] = Math.round(g * 0.95);
          img.data[o + 2] = Math.round(90 + v * 100);
        }
      } else {
        const b = Math.round(single.brightness[i]! * 220);
        const sh = single.shadowMask[i];
        img.data[o] = sh ? 30 : b;
        img.data[o + 1] = sh ? 40 : b;
        img.data[o + 2] = sh ? 80 : Math.round(b * 0.9);
      }
      img.data[o + 3] = 255;
    }
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

    // Annotate rim / floor / cold-trap proxy
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, canvas.height * 0.52, canvas.width * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fde68a";
    ctx.font = "12px sans-serif";
    ctx.fillText("Crater rim (solar-access proxy)", 16, 24);
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText("Potential cold-trap context (floor)", 16, 44);
    if (showProxy) {
      ctx.fillStyle = "#a78bfa";
      ctx.fillText("Synthetic persistent-shadow proxy — illustrative only", 16, canvas.height - 16);
    }
  }, [terrain, acc, accumulate, single, showProxy, showSolarAccess]);

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3">
        <p className="kicker">South-pole / cold-trap context · educational visualization</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Near the lunar poles, sunlight reaches the terrain at low elevation. Crater rims may receive sunlight while some
          crater floors remain shadowed. Such long-lived shadow environments are relevant to cold-trap and volatile-preservation
          studies.
        </p>
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          This visualization is not an official permanent-shadow-region calculation and does not confirm ice. Synthetic
          persistent-shadow proxy — illustrative only.
        </p>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="!p-3">
          <canvas ref={canvasRef} width={420} height={420} className="w-full rounded-xl border border-[var(--border)]" aria-hidden />
        </GlassCard>
        <GlassCard className="space-y-3">
          <label className="block text-xs text-[var(--muted)]">
            Solar elevation {elevation.toFixed(1)}° (0–10°)
            <input className="mt-1 w-full" type="range" min={0} max={10} step={0.1} value={elevation} onChange={(e) => setElevation(Number(e.target.value))} />
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Solar azimuth {azimuth.toFixed(0)}°
            <input className="mt-1 w-full" type="range" min={0} max={360} value={azimuth} onChange={(e) => setAzimuth(Number(e.target.value))} disabled={accumulate} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={sweep} onChange={(e) => setSweep(e.target.checked)} disabled={accumulate} />
            Sweep Sun direction
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={accumulate} onChange={(e) => setAccumulate(e.target.checked)} />
            Accumulate illumination
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={showProxy} onChange={(e) => setShowProxy(e.target.checked)} />
            Show synthetic persistent-shadow proxy
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={showSolarAccess} onChange={(e) => setShowSolarAccess(e.target.checked)} />
            Show solar-access zones
          </label>
          <Link to="/ice" className="btn btn-primary w-full">
            Open LUNA/ICE
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../GlassCard";
import { generateSyntheticCraterTerrain } from "../../lib/illumination/craterTerrain";
import { calculateRegistrationDifficulty } from "../../lib/illumination/solarMath";
import { simulateCraterIllumination, summarizeIllumination } from "../../lib/illumination/shadowMath";
import type { SunState } from "../../lib/illumination/types";

function paintIllumination(
  canvas: HTMLCanvasElement,
  terrainW: number,
  terrainH: number,
  brightness: Float32Array,
  shadowMask: Uint8Array,
  markStable: { x: number; y: number },
  markShadowEdge: { x: number; y: number } | null,
) {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(terrainW, terrainH);
  for (let i = 0; i < terrainW * terrainH; i++) {
    const b = Math.round(brightness[i]! * 255);
    const shadowed = shadowMask[i];
    const o = i * 4;
    img.data[o] = shadowed ? Math.round(b * 0.35) : b;
    img.data[o + 1] = shadowed ? Math.round(b * 0.4 + 20) : b;
    img.data[o + 2] = shadowed ? Math.round(b * 0.7 + 40) : Math.round(b * 0.95);
    img.data[o + 3] = 255;
  }
  // Upscale via temp canvas
  const tmp = document.createElement("canvas");
  tmp.width = terrainW;
  tmp.height = terrainH;
  tmp.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  const sx = canvas.width / terrainW;
  const sy = canvas.height / terrainH;
  ctx.strokeStyle = "#58e0d0";
  ctx.lineWidth = 2;
  ctx.strokeRect(markStable.x * sx - 6, markStable.y * sy - 6, 12, 12);
  ctx.fillStyle = "#58e0d0";
  ctx.font = "11px sans-serif";
  ctx.fillText("stable terrain feature", markStable.x * sx + 10, markStable.y * sy);
  if (markShadowEdge) {
    ctx.strokeStyle = "#fb7185";
    ctx.strokeRect(markShadowEdge.x * sx - 6, markShadowEdge.y * sy - 6, 12, 12);
    ctx.fillStyle = "#fb7185";
    ctx.fillText("unreliable visual feature", markShadowEdge.x * sx + 10, markShadowEdge.y * sy + 12);
  }
}

function findShadowEdge(shadow: Uint8Array, w: number, h: number): { x: number; y: number } | null {
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (!shadow[i]) continue;
      if (!shadow[i - 1] || !shadow[i + 1] || !shadow[i - w] || !shadow[i + w]) return { x, y };
    }
  }
  return null;
}

export function CraterShadowSimulator() {
  const terrain = useMemo(() => generateSyntheticCraterTerrain(128, 128, 26166), []);
  const [compare, setCompare] = useState(true);
  const [sunA, setSunA] = useState<SunState>({ elevationDeg: 25, azimuthDeg: 45 });
  const [sunB, setSunB] = useState<SunState>({ elevationDeg: 12, azimuthDeg: 210 });
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);

  const illumA = useMemo(() => simulateCraterIllumination(terrain, sunA), [terrain, sunA]);
  const illumB = useMemo(() => simulateCraterIllumination(terrain, sunB), [terrain, sunB]);
  const statsA = useMemo(() => summarizeIllumination(illumA), [illumA]);
  const statsB = useMemo(() => summarizeIllumination(illumB), [illumB]);
  const difficulty = useMemo(() => calculateRegistrationDifficulty(sunA, sunB), [sunA, sunB]);
  const stable = useMemo(() => ({ x: Math.round(terrain.width * 0.5), y: Math.round(terrain.height * 0.22) }), [terrain]);

  useEffect(() => {
    if (canvasA.current) {
      paintIllumination(
        canvasA.current,
        terrain.width,
        terrain.height,
        illumA.brightness,
        illumA.shadowMask,
        stable,
        findShadowEdge(illumA.shadowMask, terrain.width, terrain.height),
      );
    }
    if (compare && canvasB.current) {
      paintIllumination(
        canvasB.current,
        terrain.width,
        terrain.height,
        illumB.brightness,
        illumB.shadowMask,
        stable,
        findShadowEdge(illumB.shadowMask, terrain.width, terrain.height),
      );
    }
  }, [illumA, illumB, compare, terrain, stable]);

  const applyPreset = (name: string) => {
    if (name === "low") {
      setSunA({ elevationDeg: 8, azimuthDeg: 40 });
      setSunB({ elevationDeg: 8, azimuthDeg: 220 });
    } else if (name === "mid") {
      setSunA({ elevationDeg: 25, azimuthDeg: 45 });
      setSunB({ elevationDeg: 25, azimuthDeg: 200 });
    } else if (name === "high") {
      setSunA({ elevationDeg: 65, azimuthDeg: 50 });
      setSunB({ elevationDeg: 70, azimuthDeg: 55 });
    } else {
      setSunA({ elevationDeg: 20, azimuthDeg: 30 });
      setSunB({ elevationDeg: 20, azimuthDeg: 210 });
    }
    setCompare(true);
  };

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3">
        <p className="kicker">Illustrative crater-shadow simulation · sun-angle sensitivity</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Different Sun angles change brightness and move shadow boundaries across the same crater. The terrain remains
          fixed, but visual appearance changes. This is why LUNA/REGISTER uses preprocessing, correspondence matching,
          RANSAC outlier rejection, and quality assessment instead of relying only on raw pixel similarity.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => applyPreset("low")}>
            Low Sun — long shadows
          </button>
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => applyPreset("mid")}>
            Mid Sun
          </button>
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => applyPreset("high")}>
            High Sun — short shadows
          </button>
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => applyPreset("opp")}>
            Opposite illumination
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Comparison mode
          </label>
        </div>
      </GlassCard>

      <div className={`grid gap-4 ${compare ? "md:grid-cols-2" : ""}`}>
        <GlassCard className="space-y-2 !p-3">
          <p className="kicker px-1">Image A</p>
          <canvas ref={canvasA} width={384} height={384} className="w-full rounded-xl border border-[var(--border)]" aria-hidden />
          <label className="block px-1 text-xs text-[var(--muted)]">
            Sun elevation A {sunA.elevationDeg.toFixed(0)}°
            <input className="mt-1 w-full" type="range" min={0} max={80} value={sunA.elevationDeg} onChange={(e) => setSunA({ ...sunA, elevationDeg: Number(e.target.value) })} />
          </label>
          <label className="block px-1 text-xs text-[var(--muted)]">
            Sun azimuth A {sunA.azimuthDeg.toFixed(0)}°
            <input className="mt-1 w-full" type="range" min={0} max={360} value={sunA.azimuthDeg} onChange={(e) => setSunA({ ...sunA, azimuthDeg: Number(e.target.value) })} />
          </label>
          <p className="px-1 text-xs text-[var(--muted)]">Shadow coverage {(statsA.shadowFraction * 100).toFixed(0)}%</p>
        </GlassCard>
        {compare ? (
          <GlassCard className="space-y-2 !p-3">
            <p className="kicker px-1">Image B</p>
            <canvas ref={canvasB} width={384} height={384} className="w-full rounded-xl border border-[var(--border)]" aria-hidden />
            <label className="block px-1 text-xs text-[var(--muted)]">
              Sun elevation B {sunB.elevationDeg.toFixed(0)}°
              <input className="mt-1 w-full" type="range" min={0} max={80} value={sunB.elevationDeg} onChange={(e) => setSunB({ ...sunB, elevationDeg: Number(e.target.value) })} />
            </label>
            <label className="block px-1 text-xs text-[var(--muted)]">
              Sun azimuth B {sunB.azimuthDeg.toFixed(0)}°
              <input className="mt-1 w-full" type="range" min={0} max={360} value={sunB.azimuthDeg} onChange={(e) => setSunB({ ...sunB, azimuthDeg: Number(e.target.value) })} />
            </label>
            <p className="px-1 text-xs text-[var(--muted)]">Shadow coverage {(statsB.shadowFraction * 100).toFixed(0)}%</p>
          </GlassCard>
        ) : null}
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">
          Δ elevation {Math.abs(sunA.elevationDeg - sunB.elevationDeg).toFixed(0)}° · Registration difficulty:{" "}
          <strong className="text-[var(--text)]">{difficulty}</strong>
        </div>
        <Link to="/register" className="btn btn-primary !min-h-9 text-xs">
          Open LUNA/REGISTER
        </Link>
      </GlassCard>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GlassCard } from "../GlassCard";
import { getIlluminatedFraction, getPhaseName } from "../../lib/illumination/solarMath";

function PhaseBodies({ phaseDeg }: { phaseDeg: number }) {
  const moonRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const angle = (phaseDeg * Math.PI) / 180;

  useFrame(() => {
    if (moonRef.current) {
      moonRef.current.position.set(Math.cos(angle) * 2.4, 0, Math.sin(angle) * 2.4);
    }
    if (lightRef.current) {
      lightRef.current.position.set(6, 0.5, 0);
      lightRef.current.target.position.set(0, 0, 0);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight ref={lightRef} intensity={2.2} color="#ffe6b0" />
      <mesh position={[5.2, 0, 0]}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial emissive="#ffb347" emissiveIntensity={1.4} color="#ffd27a" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#4f8fba" roughness={0.7} />
      </mesh>
      <mesh ref={moonRef}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#cfc8ba" roughness={0.9} />
      </mesh>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={10} />
    </>
  );
}

function PhaseDisk({ phaseDeg }: { phaseDeg: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = canvas.width;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#05070f";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    // Lit half facing sun (right); terminator from phase
    const a = ((phaseDeg % 360) + 360) % 360;
    const lit = getIlluminatedFraction(a);
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#e8e2d4";
    if (a <= 180) {
      ctx.fillRect(s / 2, 0, s / 2, s);
      ctx.fillStyle = "#05070f";
      ctx.beginPath();
      ctx.ellipse(s / 2, s / 2, s * 0.42 * Math.abs(1 - 2 * lit), s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lit > 0.5) {
        ctx.fillStyle = "#e8e2d4";
        ctx.fillRect(s / 2, 0, s / 2, s);
      }
    } else {
      ctx.fillRect(0, 0, s / 2, s);
      ctx.fillStyle = "#05070f";
      ctx.beginPath();
      ctx.ellipse(s / 2, s / 2, s * 0.42 * Math.abs(1 - 2 * lit), s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lit > 0.5) {
        ctx.fillStyle = "#e8e2d4";
        ctx.fillRect(0, 0, s / 2, s);
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }, [phaseDeg]);
  return <canvas ref={canvasRef} width={180} height={180} className="rounded-full border border-[var(--border)]" aria-hidden />;
}

export function MoonPhaseTab() {
  const [phase, setPhase] = useState(90);
  const [playing, setPlaying] = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!playing || reduceMotion) return;
    const id = window.setInterval(() => setPhase((p) => (p + 1.2) % 360), 40);
    return () => window.clearInterval(id);
  }, [playing, reduceMotion]);

  const name = getPhaseName(phase);
  const frac = getIlluminatedFraction(phase);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <GlassCard className="space-y-3 !p-3">
        <p className="kicker px-2 pt-2">Sun–Moon–observer geometry · educational visualization</p>
        <div className="h-[360px] overflow-hidden rounded-2xl bg-black/40">
          <Canvas camera={{ position: [0, 3.2, 7], fov: 42 }}>
            <color attach="background" args={["#02040a"]} />
            <PhaseBodies phaseDeg={phase} />
          </Canvas>
        </div>
        <label className="block px-2 text-xs text-[var(--muted)]">
          Phase angle {phase.toFixed(0)}°
          <input
            className="mt-1 w-full"
            type="range"
            min={0}
            max={360}
            step={1}
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            aria-label="Moon phase angle"
          />
        </label>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <button type="button" className="btn btn-primary !min-h-9" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          {["New Moon", "First Quarter", "Full Moon", "Third Quarter"].map((label, i) => {
            const vals = [0, 90, 180, 270];
            return (
              <button key={label} type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => setPhase(vals[i]!)}>
                {label}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <div className="space-y-4">
        <GlassCard className="flex flex-col items-center gap-3">
          <p className="kicker">Observer preview disk</p>
          <PhaseDisk phaseDeg={phase} />
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-[var(--muted)]">Phase angle {phase.toFixed(1)}°</p>
          <p className="text-sm text-[var(--muted)]">Approx. illuminated fraction {(frac * 100).toFixed(0)}%</p>
          <p className="text-sm text-[var(--muted)]">Sun direction: +X (warm light from right of scene)</p>
        </GlassCard>
        <GlassCard className="space-y-2 text-sm leading-7 text-[var(--muted)]">
          <p className="kicker">Sun-angle sensitivity · phases</p>
          <p>
            Moon phases describe how much of the lunar disk appears illuminated to an observer. They help explain changing
            illumination, but they are different from persistent shadows inside lunar polar craters.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

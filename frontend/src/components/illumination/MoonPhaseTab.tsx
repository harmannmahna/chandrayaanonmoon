import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GlassCard } from "../GlassCard";
import { getIlluminatedFraction, getPhaseName } from "../../lib/illumination/solarMath";

function PhaseBodies({
  phaseRef,
  playingRef,
  onPhaseTick,
}: {
  phaseRef: MutableRefObject<number>;
  playingRef: MutableRefObject<boolean>;
  onPhaseTick: (deg: number) => void;
}) {
  const moonRef = useRef<THREE.Mesh>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    if (playingRef.current) {
      phaseRef.current = (phaseRef.current + dt * 22) % 360;
      onPhaseTick(phaseRef.current);
    }
    const angle = (phaseRef.current * Math.PI) / 180;
    if (moonRef.current) {
      moonRef.current.position.set(Math.cos(angle) * 2.4, 0, Math.sin(angle) * 2.4);
      // Keep a lit hemisphere facing the Sun (+X)
      moonRef.current.rotation.y = -angle;
    }
  });

  return (
    <>
      <ambientLight intensity={0.16} />
      <directionalLight position={[6, 0.8, 0]} intensity={2.4} color="#ffe6b0" target={lightTarget} />
      <primitive object={lightTarget} position={[0, 0, 0]} />
      {/* Sun */}
      <mesh position={[5.2, 0, 0]}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial emissive="#ffb347" emissiveIntensity={1.6} color="#ffd27a" />
      </mesh>
      {/* Earth / observer reference */}
      <mesh>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#4f8fba" roughness={0.7} />
      </mesh>
      {/* Moon */}
      <mesh ref={moonRef}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color="#cfc8ba" roughness={0.85} metalness={0.05} />
      </mesh>
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={4} maxDistance={10} />
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
    const cx = s / 2;
    const cy = s / 2;
    const r = s * 0.42;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#05070f";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const a = ((phaseDeg % 360) + 360) % 360;
    // Simple terminator: shade left/right with elliptical dark overlay
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#e8e2d4";
    ctx.fillRect(0, 0, s, s);
    // Dark cap moves with phase (0 = new / fully dark toward viewer model)
    const k = Math.cos((a * Math.PI) / 180); // 1 at new? wait: illuminated = 0.5*(1-cos) so at 0 new, cos=1
    // Draw night side as vertical gradient ellipse offset
    ctx.fillStyle = "#05070f";
    if (a < 180) {
      // waxing: lit on right
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, 0, cx, s);
      if (k < 0) {
        // past quarter: clear left night wrongly — redraw lit right
        ctx.globalCompositeOperation = "destination-over";
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx, 0, cx, s);
    }
    ctx.restore();

    // Cleaner redraw using illuminated fraction
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#05070f";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const lit = getIlluminatedFraction(a);
    ctx.fillStyle = "#e8e2d4";
    if (a <= 180) {
      // waxing — light from right
      ctx.fillRect(cx, 0, cx, s);
      ctx.fillStyle = lit > 0.5 ? "#e8e2d4" : "#05070f";
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(1 - 2 * lit) * r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lit <= 0.5) {
        ctx.fillStyle = "#05070f";
        ctx.fillRect(0, 0, cx, s);
      } else {
        ctx.fillStyle = "#e8e2d4";
        ctx.fillRect(cx, 0, cx, s);
      }
    } else {
      // waning — light from left
      ctx.fillRect(0, 0, cx, s);
      ctx.fillStyle = lit > 0.5 ? "#e8e2d4" : "#05070f";
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(1 - 2 * lit) * r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lit <= 0.5) {
        ctx.fillStyle = "#05070f";
        ctx.fillRect(cx, 0, cx, s);
      } else {
        ctx.fillStyle = "#e8e2d4";
        ctx.fillRect(0, 0, cx, s);
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }, [phaseDeg]);

  return <canvas ref={canvasRef} width={180} height={180} className="rounded-full border border-[var(--border)]" aria-hidden />;
}

export function MoonPhaseTab() {
  const [phase, setPhase] = useState(90);
  const [playing, setPlaying] = useState(false);
  const phaseRef = useRef(90);
  const playingRef = useRef(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    playingRef.current = playing && !reduceMotion;
  }, [playing, reduceMotion]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const onPhaseTick = (deg: number) => {
    // Throttle React state updates for smooth UI without flooding renders
    setPhase((prev) => (Math.abs(prev - deg) > 0.4 ? deg : prev));
  };

  const setPhaseBoth = (deg: number) => {
    phaseRef.current = deg;
    setPhase(deg);
  };

  const name = getPhaseName(phase);
  const frac = getIlluminatedFraction(phase);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <GlassCard className="space-y-3 !p-3">
        <p className="kicker px-2 pt-2">Sun–Moon–observer geometry · educational visualization</p>
        <div className="h-[360px] overflow-hidden rounded-2xl bg-black/40">
          <Canvas camera={{ position: [0, 3.2, 7], fov: 42 }}>
            <color attach="background" args={["#02040a"]} />
            <PhaseBodies phaseRef={phaseRef} playingRef={playingRef} onPhaseTick={onPhaseTick} />
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
            onChange={(e) => {
              setPlaying(false);
              setPhaseBoth(Number(e.target.value));
            }}
            aria-label="Moon phase angle"
          />
        </label>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <button
            type="button"
            className="btn btn-primary !min-h-9"
            onClick={() => setPlaying((p) => !p)}
            disabled={reduceMotion}
          >
            {playing ? "Pause" : "Play"}
          </button>
          {[
            ["New Moon", 0],
            ["First Quarter", 90],
            ["Full Moon", 180],
            ["Third Quarter", 270],
          ].map(([label, val]) => (
            <button
              key={String(label)}
              type="button"
              className="btn btn-secondary !min-h-9 text-xs"
              onClick={() => {
                setPlaying(false);
                setPhaseBoth(Number(val));
              }}
            >
              {label}
            </button>
          ))}
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

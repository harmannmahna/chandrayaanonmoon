import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { DoubleSide, Group, MathUtils, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GlassCard } from "../components/GlassCard";
import { useAppStore } from "../store/appStore";

type BodyInfo = {
  id: string;
  name: string;
  color: string;
  radius: number;
  distance: number;
  kind: string;
  blurb: string;
  facts: string[];
  actions?: { label: string; to: string; primary?: boolean }[];
};

const BODIES: BodyInfo[] = [
  {
    id: "sun",
    name: "Sun",
    color: "#ffb347",
    radius: 1.6,
    distance: 0,
    kind: "G-type star",
    blurb:
      "Solar wind and sun angle drive lunar shadow geometry — the reason registration must survive illumination change.",
    facts: [
      "Illumination angle is a core PS 26166 challenge for Chandrayaan-2 matching.",
      "CLAHE in LunaMatch boosts local contrast when sun-angle washes or shadows terrain.",
    ],
    actions: [{ label: "Open registration", to: "/register", primary: true }],
  },
  {
    id: "mercury",
    name: "Mercury",
    color: "#b0a99f",
    radius: 0.22,
    distance: 3.2,
    kind: "Terrestrial planet",
    blurb: "Extreme day/night swings and a heavily cratered surface — another harsh-lighting correspondence setting.",
    facts: [
      "Cratered highlands resemble lunar texture challenges.",
      "Useful analogy for scale + illumination robustness in matching.",
    ],
    actions: [{ label: "See registration pipeline", to: "/register" }],
  },
  {
    id: "venus",
    name: "Venus",
    color: "#e8c07a",
    radius: 0.34,
    distance: 4.2,
    kind: "Terrestrial planet",
    blurb: "Thick CO₂ clouds hide the surface in optical bands — radar mapping is required instead.",
    facts: [
      "Shows why multi-modal data (optical + radar) matters.",
      "LunaMatch ice flow similarly pairs optical context with radar CPR/DOP logic.",
    ],
    actions: [{ label: "Ice screening demo", to: "/ice", primary: true }],
  },
  {
    id: "earth",
    name: "Earth",
    color: "#4f8fba",
    radius: 0.38,
    distance: 5.4,
    kind: "Terrestrial planet",
    blurb: "Home of Chandrayaan-2 and the ground segment that receives OHRC / TMC-2 / IIRS products.",
    facts: [
      "ISRO downlink & processing start here before lunar products are fused.",
      "Mission briefing explains the orbiter instruments LunaMatch targets.",
    ],
    actions: [
      { label: "Mission briefing", to: "/briefing", primary: true },
      { label: "Registration wizard", to: "/register" },
    ],
  },
  {
    id: "moon",
    name: "Moon",
    color: "#cfc8ba",
    radius: 0.16,
    distance: 6.15,
    kind: "Natural satellite",
    blurb: "LunaMatch target. Multi-mission imagery must be registered before ice or landing analyses.",
    facts: [
      "Align Chandrayaan-2 frames to LRO / SELENE-style references.",
      "Registration enables CPR/DOP ice overlays to be trusted on a shared grid.",
    ],
    actions: [
      { label: "Image registration", to: "/register", primary: true },
      { label: "Ice detection", to: "/ice" },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    color: "#c45c3e",
    radius: 0.3,
    distance: 7.2,
    kind: "Terrestrial planet",
    blurb: "Iron-rich deserts and polar ice — a cousin problem for orbital image correspondence.",
    facts: [
      "Orbital mosaics also face illumination and scale drift.",
      "Same CLAHE → match → RANSAC story transfers as a methods analogy.",
    ],
    actions: [{ label: "Try registration pipeline", to: "/register", primary: true }],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    color: "#d4a574",
    radius: 0.9,
    distance: 9.2,
    kind: "Gas giant",
    blurb: "A miniature solar system of moons — context for why multi-body exploration UIs help explain mission scope.",
    facts: [
      "Not a LunaMatch processing target — included for solar-system orientation.",
      "Helps judges place the Moon among peer destinations.",
    ],
    actions: [{ label: "Back to mission briefing", to: "/briefing" }],
  },
  {
    id: "saturn",
    name: "Saturn",
    color: "#e6d3a3",
    radius: 0.78,
    distance: 11.2,
    kind: "Gas giant",
    blurb: "Ringed world; icy moons host some of the outer system's most interesting volatiles.",
    facts: [
      "Icy-moon science is a distant cousin of lunar PSR ice screening.",
      "LunaMatch keeps the ice demo lunar-focused (CPR > 1 and DOP < 0.13).",
    ],
    actions: [{ label: "Open ice demo", to: "/ice", primary: true }],
  },
  {
    id: "uranus",
    name: "Uranus",
    color: "#7ec8d8",
    radius: 0.5,
    distance: 13.0,
    kind: "Ice giant",
    blurb: "Tipped on its side with extreme seasons and a faint ring system.",
    facts: [
      "Educational body in this explorer — use Moon / Earth for LunaMatch workflows.",
      "Completes the planetary tour for judges navigating the demo.",
    ],
    actions: [{ label: "Go to Moon workflow", to: "/register", primary: true }],
  },
  {
    id: "neptune",
    name: "Neptune",
    color: "#4169e1",
    radius: 0.48,
    distance: 14.6,
    kind: "Ice giant",
    blurb: "Farthest major planet; methane-tinted atmosphere and the fastest winds in the system.",
    facts: [
      "Completes the eight-planet tour for the explorer page.",
      "LunaMatch science path remains Earth → Moon registration → ice screen.",
    ],
    actions: [
      { label: "Mission briefing", to: "/briefing", primary: true },
      { label: "Home", to: "/" },
    ],
  },
];

function bodyWorldPosition(body: BodyInfo, angle: number) {
  if (body.distance <= 0) return new Vector3(0, 0, 0);
  return new Vector3(Math.cos(angle) * body.distance, 0, Math.sin(angle) * body.distance);
}

function PlanetMesh({
  body,
  selected,
  onSelect,
  angleOffset,
  angleRef,
}: {
  body: BodyInfo;
  selected: boolean;
  onSelect: () => void;
  angleOffset: number;
  angleRef: MutableRefObject<Record<string, number>>;
}) {
  const group = useRef<Group>(null);
  const speed = useMemo(
    () => (body.distance > 0 ? 0.08 / Math.sqrt(body.distance) : 0),
    [body.distance],
  );
  const emissive = body.id === "sun" ? body.color : selected ? body.color : "#000000";
  const hitRadius = Math.max(body.radius * 1.4, 0.38);

  useFrame((_, delta) => {
    if (!group.current) return;
    if (body.distance > 0) group.current.rotation.y += delta * speed;
    angleRef.current[body.id] = group.current.rotation.y + angleOffset;
  });

  return (
    <group ref={group} rotation={[0, angleOffset, 0]}>
      <mesh
        position={[body.distance, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[body.distance, 0, 0]}>
        <sphereGeometry args={[body.radius, 32, 32]} />
        <meshStandardMaterial
          color={body.color}
          emissive={emissive}
          emissiveIntensity={body.id === "sun" ? 0.85 : selected ? 0.45 : 0}
          roughness={body.id === "sun" ? 0.4 : 0.85}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function OrbitRing({ distance, active }: { distance: number; active: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry
        args={[distance - (active ? 0.03 : 0.015), distance + (active ? 0.03 : 0.015), 96]}
      />
      <meshBasicMaterial
        color={active ? "#58e0d0" : "#ffffff"}
        transparent
        opacity={active ? 0.45 : 0.14}
        side={DoubleSide}
      />
    </mesh>
  );
}

function CameraFocus({
  target,
  controlsRef,
}: {
  target: Vector3 | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const anim = useRef({
    active: false,
    t: 0,
    from: new Vector3(),
    to: new Vector3(),
    look: new Vector3(),
  });

  useEffect(() => {
    if (!target) return;
    anim.current.active = true;
    anim.current.t = 0;
    anim.current.from.copy(camera.position);
    anim.current.look.copy(target);

    if (target.length() < 0.2) {
      anim.current.to.set(0, 5, 12);
    } else {
      const outward = target.clone().normalize();
      const dist = MathUtils.clamp(target.length() * 0.55 + 4.5, 5, 16);
      anim.current.to.copy(target).addScaledVector(outward, dist);
      anim.current.to.y += 2.2;
    }

    const controls = controlsRef.current;
    if (controls) controls.autoRotate = false;
  }, [target, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!anim.current.active) return;
    anim.current.t = Math.min(1, anim.current.t + delta * 1.35);
    const k = 1 - (1 - anim.current.t) ** 3;
    camera.position.lerpVectors(anim.current.from, anim.current.to, k);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(anim.current.look, k);
      controls.update();
    } else {
      camera.lookAt(anim.current.look);
    }
    if (anim.current.t >= 1) anim.current.active = false;
  });

  return null;
}

export function SolarSystemPage() {
  const theme = useAppStore((s) => s.theme);
  const [selectedId, setSelectedId] = useState("moon");
  const [focusTarget, setFocusTarget] = useState<Vector3 | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const selected = BODIES.find((b) => b.id === selectedId) ?? BODIES[4];
  const angleRef = useRef<Record<string, number>>({});
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const selectBody = (id: string) => {
    setSelectedId(id);
    const body = BODIES.find((b) => b.id === id);
    if (!body) return;
    const angle = angleRef.current[id] ?? 0;
    setFocusTarget(bodyWorldPosition(body, angle));
    setAutoRotate(false);
  };

  return (
    <div className="page space-y-6">
      <GlassCard>
        <p className="kicker">Explore</p>
        <h1 className="mt-2 text-3xl font-semibold">Solar System</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Click any planet in the view or use the buttons. Each body opens facts plus LunaMatch links
          where relevant.
        </p>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="min-h-[480px] overflow-hidden !p-2">
          <div className="h-[480px] w-full overflow-hidden rounded-2xl">
            <Canvas camera={{ position: [0, 6, 16], fov: 42 }}>
              <color attach="background" args={[theme === "dark" ? "#02040a" : "#b9d9f7"]} />
              <ambientLight intensity={0.45} />
              <pointLight position={[0, 0, 0]} intensity={2.2} distance={40} />
              {theme === "dark" ? (
                <Stars radius={120} depth={50} count={1800} factor={3} saturation={0} fade speed={0.3} />
              ) : null}
              {BODIES.filter((b) => b.distance > 0).map((b) => (
                <OrbitRing key={`orbit-${b.id}`} distance={b.distance} active={selectedId === b.id} />
              ))}
              {BODIES.map((b, i) => (
                <PlanetMesh
                  key={b.id}
                  body={b}
                  selected={selectedId === b.id}
                  onSelect={() => selectBody(b.id)}
                  angleOffset={i * 0.55}
                  angleRef={angleRef}
                />
              ))}
              <CameraFocus target={focusTarget} controlsRef={controlsRef} />
              <OrbitControls
                ref={controlsRef}
                enablePan
                enableDamping
                dampingFactor={0.07}
                rotateSpeed={0.5}
                zoomSpeed={0.7}
                minDistance={4}
                maxDistance={32}
                autoRotate={autoRotate}
                autoRotateSpeed={0.22}
                onStart={() => setAutoRotate(false)}
              />
            </Canvas>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <p className="text-xs text-[var(--muted)]">
              Drag to orbit · scroll to zoom · click a body to focus
            </p>
            <button
              type="button"
              className="btn btn-secondary !min-h-8 !px-3 text-xs"
              onClick={() => setAutoRotate((v) => !v)}
            >
              {autoRotate ? "Pause spin" : "Resume spin"}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="h-fit space-y-4">
          <p className="kicker">Selected body · {selected.kind}</p>
          <h2 className="text-2xl font-semibold">{selected.name}</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">{selected.blurb}</p>

          <ul className="space-y-2 rounded-2xl border border-[var(--border)] bg-black/20 p-4 text-sm leading-6 text-[var(--muted)]">
            {selected.facts.map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-[var(--accent)]">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>

          {selected.actions?.length ? (
            <div className="flex flex-wrap gap-3 pt-1">
              {selected.actions.map((a) => (
                <Link
                  key={`${a.to}-${a.label}`}
                  to={a.to}
                  className={`btn ${a.primary ? "btn-primary" : "btn-secondary"}`}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {BODIES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn !min-h-9 !px-3 text-xs ${
                  selectedId === b.id ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => selectBody(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

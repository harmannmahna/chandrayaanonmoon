import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DoubleSide } from "three";
import { GlassCard } from "../components/GlassCard";
import { useAppStore } from "../store/appStore";

type BodyInfo = {
  id: string;
  name: string;
  color: string;
  radius: number;
  distance: number;
  blurb: string;
  moonLink?: boolean;
};

const BODIES: BodyInfo[] = [
  {
    id: "sun",
    name: "Sun",
    color: "#ffb347",
    radius: 1.6,
    distance: 0,
    blurb: "G-type star at the center of our system. Solar wind and illumination drive lunar shadow geometry.",
  },
  {
    id: "mercury",
    name: "Mercury",
    color: "#b0a99f",
    radius: 0.22,
    distance: 3.2,
    blurb: "Innermost planet — extreme temperature swings and a cratered surface.",
  },
  {
    id: "venus",
    name: "Venus",
    color: "#e8c07a",
    radius: 0.34,
    distance: 4.2,
    blurb: "Thick CO₂ atmosphere and runaway greenhouse — radar, not optical, peeks through the clouds.",
  },
  {
    id: "earth",
    name: "Earth",
    color: "#4f8fba",
    radius: 0.38,
    distance: 5.4,
    blurb: "Home of Chandrayaan-2 and the ground segment that receives OHRC / TMC-2 / IIRS data.",
  },
  {
    id: "moon",
    name: "Moon",
    color: "#cfc8ba",
    radius: 0.16,
    distance: 6.15,
    blurb: "LunaMatch target. Multi-mission imagery must be registered before ice or landing analyses.",
    moonLink: true,
  },
  {
    id: "mars",
    name: "Mars",
    color: "#c45c3e",
    radius: 0.3,
    distance: 7.2,
    blurb: "Iron-rich deserts and polar ice — a cousin problem for orbital image correspondence.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    color: "#d4a574",
    radius: 0.9,
    distance: 9.2,
    blurb: "Gas giant with a miniature solar system of moons.",
  },
  {
    id: "saturn",
    name: "Saturn",
    color: "#e6d3a3",
    radius: 0.78,
    distance: 11.2,
    blurb: "Ringed world; icy moons host some of the outer system's most interesting volatiles.",
  },
  {
    id: "uranus",
    name: "Uranus",
    color: "#7ec8d8",
    radius: 0.5,
    distance: 13.0,
    blurb: "Ice giant tipped on its side — extreme seasons and a faint ring system.",
  },
  {
    id: "neptune",
    name: "Neptune",
    color: "#4169e1",
    radius: 0.48,
    distance: 14.6,
    blurb: "Farthest major planet; methane-tinted atmosphere and the fastest winds in the system.",
  },
];

function PlanetMesh({
  body,
  selected,
  onSelect,
}: {
  body: BodyInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  const emissive = body.id === "sun" ? body.color : "#000000";
  return (
    <mesh position={[body.distance, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <sphereGeometry args={[body.radius, 32, 32]} />
      <meshStandardMaterial
        color={body.color}
        emissive={emissive}
        emissiveIntensity={body.id === "sun" ? 0.85 : selected ? 0.25 : 0}
        roughness={body.id === "sun" ? 0.4 : 0.85}
        metalness={0.05}
      />
    </mesh>
  );
}

function OrbitRing({ distance }: { distance: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[distance - 0.015, distance + 0.015, 96]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.14} side={DoubleSide} />
    </mesh>
  );
}

export function SolarSystemPage() {
  const theme = useAppStore((s) => s.theme);
  const [selectedId, setSelectedId] = useState<string>("moon");
  const selected = BODIES.find((b) => b.id === selectedId) ?? BODIES[4];

  return (
    <div className="page space-y-6">
      <GlassCard>
        <p className="kicker">Explore</p>
        <h1 className="mt-2 text-3xl font-semibold">Solar System</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Click a body for a glass briefing card. The Moon links into LunaMatch registration and ice flows.
        </p>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="overflow-hidden !p-2 min-h-[480px]">
          <div className="h-[480px] w-full overflow-hidden rounded-2xl">
            <Canvas camera={{ position: [0, 6, 16], fov: 42 }}>
              <color attach="background" args={[theme === "dark" ? "#02040a" : "#b9d9f7"]} />
              <ambientLight intensity={0.45} />
              <pointLight position={[0, 0, 0]} intensity={2.2} distance={40} />
              {theme === "dark" ? (
                <Stars radius={120} depth={50} count={1800} factor={3} saturation={0} fade speed={0.3} />
              ) : null}
              {BODIES.filter((b) => b.distance > 0).map((b) => (
                <OrbitRing key={`orbit-${b.id}`} distance={b.distance} />
              ))}
              {BODIES.map((b) => (
                <PlanetMesh
                  key={b.id}
                  body={b}
                  selected={selectedId === b.id}
                  onSelect={() => setSelectedId(b.id)}
                />
              ))}
              <OrbitControls enablePan minDistance={6} maxDistance={28} />
            </Canvas>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4 h-fit">
          <p className="kicker">Selected body</p>
          <h2 className="text-2xl font-semibold">{selected.name}</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">{selected.blurb}</p>
          {selected.moonLink ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/register" className="btn btn-primary">
                Image registration
              </Link>
              <Link to="/ice" className="btn btn-secondary">
                Ice detection
              </Link>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {BODIES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn !min-h-9 !px-3 text-xs ${selectedId === b.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedId(b.id)}
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

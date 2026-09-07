import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
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
import { MoonPhaseTab } from "../components/illumination/MoonPhaseTab";
import { CraterShadowSimulator } from "../components/illumination/CraterShadowSimulator";
import { SouthPoleSimulator } from "../components/illumination/SouthPoleSimulator";
import { ProjectRelevance } from "../components/illumination/ProjectRelevance";

type SolarSection = "system" | "phases" | "crater" | "pole" | "relevance";

const SECTIONS: { id: SolarSection; label: string }[] = [
  { id: "system", label: "Solar System" },
  { id: "phases", label: "Moon Phases" },
  { id: "crater", label: "Crater Shadows" },
  { id: "pole", label: "South Pole / Cold-Trap" },
  { id: "relevance", label: "Project Relevance" },
];

type BodyInfo = {
  id: string;
  name: string;
  color: string;
  radius: number;
  distance: number;
  kind: string;
  blurb: string;
  facts: string[];
  /** Short planet facts shown when the body is selected */
  info: Array<{ label: string; value: string }>;
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
      "The Sun is the star at the center of our solar system. Its light and solar wind shape illumination and space weather across the planets — including shadow geometry on the Moon.",
    info: [
      { label: "Type", value: "G2V yellow dwarf" },
      { label: "Diameter", value: "~1.39 million km" },
      { label: "Mass", value: "~333,000 × Earth" },
      { label: "Surface temp", value: "~5,500 °C (photosphere)" },
      { label: "Age", value: "~4.6 billion years" },
    ],
    facts: [
      "Provides nearly all energy that drives lunar day/night and polar illumination.",
      "Changing sun angle is a core PS 26166 challenge for Chandrayaan-2 image matching.",
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
    blurb:
      "Mercury is the smallest planet and closest to the Sun. It has almost no atmosphere, a heavily cratered surface, and extreme day/night temperature swings.",
    info: [
      { label: "Order from Sun", value: "1st" },
      { label: "Avg. distance", value: "~0.39 AU" },
      { label: "Diameter", value: "~4,880 km" },
      { label: "Moons", value: "0" },
      { label: "Day length", value: "~59 Earth days" },
      { label: "Year length", value: "~88 Earth days" },
    ],
    facts: [
      "Cratered highlands and harsh lighting resemble lunar texture challenges.",
      "Useful analogy for scale + illumination robustness in image matching.",
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
    blurb:
      "Venus is similar in size to Earth but wrapped in a thick CO₂ atmosphere and clouds. Optical surface mapping is blocked, so radar is used to see the ground.",
    info: [
      { label: "Order from Sun", value: "2nd" },
      { label: "Avg. distance", value: "~0.72 AU" },
      { label: "Diameter", value: "~12,100 km" },
      { label: "Moons", value: "0" },
      { label: "Atmosphere", value: "Dense CO₂ + clouds" },
      { label: "Surface temp", value: "~465 °C" },
    ],
    facts: [
      "Shows why optical + radar pairing matters for future multi-modal lunar workflows.",
      "LUNA/ICE demo pairs optical context with illustrative CPR/DOP planning layers.",
    ],
    actions: [{ label: "Open ice mission planner", to: "/ice", primary: true }],
  },
  {
    id: "earth",
    name: "Earth",
    color: "#4f8fba",
    radius: 0.38,
    distance: 5.4,
    kind: "Terrestrial planet",
    blurb:
      "Earth is our home world and the launch / ground-segment base for Chandrayaan-2. Oceans, atmosphere, and a large Moon make it unique in the inner solar system.",
    info: [
      { label: "Order from Sun", value: "3rd" },
      { label: "Avg. distance", value: "1 AU (~150 million km)" },
      { label: "Diameter", value: "~12,740 km" },
      { label: "Moons", value: "1 (the Moon)" },
      { label: "Day length", value: "~24 hours" },
      { label: "Year length", value: "~365.25 days" },
    ],
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
    blurb:
      "Earth’s Moon is LunaMatch’s target body. It has no thick atmosphere, extreme lighting contrasts, and polar cold traps relevant to ice studies.",
    info: [
      { label: "Type", value: "Natural satellite of Earth" },
      { label: "Avg. distance from Earth", value: "~384,000 km" },
      { label: "Diameter", value: "~3,475 km" },
      { label: "Day / night cycle", value: "~29.5 Earth days" },
      { label: "Atmosphere", value: "Exosphere (negligible)" },
      { label: "Key challenge", value: "Sun-angle & multi-mission registration" },
    ],
    facts: [
      "Align Chandrayaan-2 frames to LRO / SELENE-style references.",
      "Registration helps place ice/landing overlays on a shared grid.",
    ],
    actions: [
      { label: "Image registration", to: "/register", primary: true },
      { label: "Ice mission planner", to: "/ice" },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    color: "#c45c3e",
    radius: 0.3,
    distance: 7.2,
    kind: "Terrestrial planet",
    blurb:
      "Mars is a cold, dusty desert world with polar ice caps, giant volcanoes, and canyons. Orbital images also face illumination and scale challenges.",
    info: [
      { label: "Order from Sun", value: "4th" },
      { label: "Avg. distance", value: "~1.52 AU" },
      { label: "Diameter", value: "~6,790 km" },
      { label: "Moons", value: "2 (Phobos, Deimos)" },
      { label: "Day length", value: "~24.6 hours" },
      { label: "Year length", value: "~687 Earth days" },
    ],
    facts: [
      "Orbital mosaics face illumination and scale drift — similar correspondence issues.",
      "CLAHE → match → RANSAC methods transfer as a useful analogy.",
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
    blurb:
      "Jupiter is the largest planet — a gas giant with a strong magnetic field, bands of clouds, and dozens of moons (a miniature solar system).",
    info: [
      { label: "Order from Sun", value: "5th" },
      { label: "Avg. distance", value: "~5.2 AU" },
      { label: "Diameter", value: "~140,000 km" },
      { label: "Moons", value: "95+ known" },
      { label: "Day length", value: "~10 hours" },
      { label: "Year length", value: "~12 Earth years" },
    ],
    facts: [
      "Included for solar-system orientation — not a LunaMatch processing target.",
      "Helps place the Moon among other exploration destinations.",
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
    blurb:
      "Saturn is famous for its bright ring system. It is a gas giant with many icy moons, some of interest for outer-system volatiles research.",
    info: [
      { label: "Order from Sun", value: "6th" },
      { label: "Avg. distance", value: "~9.5 AU" },
      { label: "Diameter", value: "~116,500 km" },
      { label: "Moons", value: "140+ known" },
      { label: "Rings", value: "Prominent ice/rock ring system" },
      { label: "Year length", value: "~29 Earth years" },
    ],
    facts: [
      "Icy-moon science is a distant cousin of lunar polar cold-trap studies.",
      "LunaMatch keeps the ice planner focused on the Moon.",
    ],
    actions: [{ label: "Open ice mission planner", to: "/ice", primary: true }],
  },
  {
    id: "uranus",
    name: "Uranus",
    color: "#7ec8d8",
    radius: 0.5,
    distance: 13.0,
    kind: "Ice giant",
    blurb:
      "Uranus is an ice giant tipped on its side, with extreme seasons and a faint ring system. It appears blue-green from methane in its atmosphere.",
    info: [
      { label: "Order from Sun", value: "7th" },
      { label: "Avg. distance", value: "~19.2 AU" },
      { label: "Diameter", value: "~50,700 km" },
      { label: "Moons", value: "28 known" },
      { label: "Tilt", value: "~98° (rolls on its side)" },
      { label: "Year length", value: "~84 Earth years" },
    ],
    facts: [
      "Educational body in this explorer — use Moon / Earth for LunaMatch workflows.",
      "Completes the planetary tour for navigating the demo.",
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
    blurb:
      "Neptune is the farthest major planet from the Sun. It has a methane-tinted atmosphere and some of the fastest winds in the solar system.",
    info: [
      { label: "Order from Sun", value: "8th" },
      { label: "Avg. distance", value: "~30.1 AU" },
      { label: "Diameter", value: "~49,200 km" },
      { label: "Moons", value: "16 known" },
      { label: "Winds", value: "Up to ~2,000 km/h" },
      { label: "Year length", value: "~165 Earth years" },
    ],
    facts: [
      "Completes the eight-planet tour on this explorer page.",
      "LunaMatch science path remains Earth → Moon registration → ice planner.",
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
  const [section, setSection] = useState<SolarSection>("system");
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
      <GlassCard className="space-y-4">
        <div>
          <p className="kicker">Explore · Solar + Illumination Lab</p>
          <h1 className="mt-2 text-3xl font-semibold">Solar System & Illumination</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Orbit the planets, then explore educational sun-angle visuals — Moon phases, illustrative crater shadows, and
            polar cold-trap context. Teaching layer only; Register and Ice pipelines stay unchanged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Solar sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              className={`btn !min-h-9 text-xs ${section === s.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
      {section === "system" ? (
      <motion.div
        key="system"
        className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
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
          <div key={selected.id} className="space-y-4">
            <p className="kicker">Selected body · {selected.kind}</p>
            <h2 className="text-2xl font-semibold">{selected.name}</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">{selected.blurb}</p>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black/20">
              <p className="border-b border-[var(--border)] px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Planet information
              </p>
              <dl className="divide-y divide-[var(--border)]">
                {selected.info.map((row) => (
                  <div key={row.label} className="grid grid-cols-[0.9fr_1.1fr] gap-3 px-4 py-2.5 text-sm">
                    <dt className="text-[var(--muted)]">{row.label}</dt>
                    <dd className="font-medium text-[var(--text)]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

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
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            {BODIES.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn !min-h-9 !px-3 text-xs ${
                  selectedId === b.id ? "btn-primary" : "btn-secondary"
                }`}
                onClick={() => selectBody(b.id)}
                aria-pressed={selectedId === b.id}
              >
                {b.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary w-full text-xs" onClick={() => setSection("phases")}>
            Open Illumination Lab · Moon Phases
          </button>
        </GlassCard>
      </motion.div>
      ) : null}

      {section === "phases" ? (
        <motion.div
          key="phases"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <MoonPhaseTab />
        </motion.div>
      ) : null}
      {section === "crater" ? (
        <motion.div
          key="crater"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <CraterShadowSimulator />
        </motion.div>
      ) : null}
      {section === "pole" ? (
        <motion.div
          key="pole"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <SouthPoleSimulator />
        </motion.div>
      ) : null}
      {section === "relevance" ? (
        <motion.div
          key="relevance"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProjectRelevance />
        </motion.div>
      ) : null}
      </AnimatePresence>

      {section !== "system" ? (
        <GlassCard className="space-y-2 text-xs leading-6 text-[var(--muted)]">
          <p className="kicker">Prototype assumptions and limits</p>
          <ul className="space-y-1">
            <li>• Moon phase and crater-shadow visuals are educational synthetic simulations.</li>
            <li>• No SPICE / official PSR / calibrated mission products are used here.</li>
            <li>• This Illumination Lab explains context only — it does not alter Register or Ice outputs.</li>
          </ul>
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => setSection("system")}>
            Back to Solar System view
          </button>
        </GlassCard>
      ) : null}
    </div>
  );
}

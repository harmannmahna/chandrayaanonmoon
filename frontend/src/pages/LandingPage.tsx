import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Aperture, Orbit, Snowflake, BookOpen } from "lucide-react";
import { GlassCard } from "../components/GlassCard";
import { MoonScene } from "../components/MoonScene";

const CARDS = [
  {
    to: "/register",
    icon: Aperture,
    title: "Image Registration",
    desc: "Align Chandrayaan-2 imagery with lunar reference maps",
  },
  {
    to: "/ice",
    icon: Snowflake,
    title: "Ice Detection",
    desc: "Map water-ice signatures in permanently shadowed craters",
  },
  {
    to: "/solar",
    icon: Orbit,
    title: "Solar System Explorer",
    desc: "Sun, Moon and the eight planets, to scale of relation",
  },
  {
    to: "/briefing",
    icon: BookOpen,
    title: "Mission Briefing",
    desc: "What is Chandrayaan-2, and what are we building?",
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="page grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard className="!p-6">
            <p className="kicker">Landing · Smart India Hackathon · PS 26166</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">LunaMatch</h1>
            <p className="mt-3 max-w-xl text-[var(--muted)] leading-7">
              Multi-modal, sun-angle and scale-invariant lunar image correspondence — pitch your mission, then explore the
              interactive Moon.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={() => navigate("/register")}>
                Start registration
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate("/briefing")}>
                Mission briefing
              </button>
            </div>
          </GlassCard>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.to}
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassCard hover className="h-full w-full" onClick={() => navigate(card.to)}>
                <card.icon className="mb-3 text-[var(--accent)]" size={22} />
                <h2 className="text-lg font-medium">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassCard className="min-h-[420px] overflow-hidden !p-2">
          <p className="px-3 pb-1 pt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Interactive 3D Moon</p>
          <div className="h-[420px] w-full overflow-hidden rounded-2xl">
            <MoonScene />
          </div>
          <p className="px-3 pb-2 pt-3 text-center text-xs text-[var(--muted)]">
            Drag to orbit · scroll to zoom · auto-rotates with inertia
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}

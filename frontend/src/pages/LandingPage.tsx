import { useNavigate } from "react-router-dom";
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
        <GlassCard className="!p-6">
          <p className="kicker">Smart India Hackathon · PS 26166</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">LunaMatch</h1>
          <p className="mt-3 max-w-xl text-[var(--muted)] leading-7">
            Multi-modal, sun-angle and scale-invariant lunar image correspondence — explained stage by
            stage so judges can see <em>why</em> matches succeed or fail.
          </p>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => (
            <GlassCard
              key={card.to}
              hover
              className="h-full w-full"
              onClick={() => navigate(card.to)}
            >
              <card.icon className="mb-3 text-[var(--accent)]" size={22} />
              <h2 className="text-lg font-medium">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      <GlassCard className="min-h-[420px] overflow-hidden !p-2">
        <div className="h-[420px] w-full overflow-hidden rounded-2xl">
          <MoonScene />
        </div>
        <p className="px-3 pb-2 pt-3 text-center text-xs text-[var(--muted)]">
          Drag to orbit the Moon · auto-rotates gently
        </p>
      </GlassCard>
    </div>
  );
}

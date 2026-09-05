import { motion } from "framer-motion";
import { GlassCard } from "../components/GlassCard";

const STEPS = [
  {
    kicker: "01 · Mission",
    title: "Chandrayaan-2",
    body: "ISRO’s Chandrayaan-2 orbiter continues to image the Moon years after landing attempts. Its suite delivers multi-resolution optical and infrared products that must be fused with heritage maps from LRO and SELENE.",
  },
  {
    kicker: "02 · Instruments",
    title: "OHRC · TMC-2 · IIRS",
    body: "OHRC provides sub-metre morphology in permanently shadowed regions. TMC-2 builds stereo DEMs. IIRS maps mineral and volatile signatures across wavelengths — three modalities that rarely share the same sun angle or pixel grid.",
  },
  {
    kicker: "03 · The problem",
    title: "Why registration is hard",
    body: "Lunar correspondence fights illumination extremes, weak texture on mare plains, scale differences between missions, and sparse overlap. Classical detectors break; dense matchers need contrast prep and geometric verification.",
  },
  {
    kicker: "04 · LunaMatch",
    title: "What we provide",
    body: "A judge-readable pipeline: CLAHE for local contrast, LoFTR-style matching with weak-region diagnostics, RANSAC with plain-language conclusions, and an ice-screening demo that shows registration as the enabler for subsurface ice PS work.",
  },
];

export function MissionBriefingPage() {
  return (
    <div className="page space-y-6">
      <GlassCard>
        <p className="kicker">Context</p>
        <h1 className="mt-2 text-3xl font-semibold">Mission Briefing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Scroll the glass panels — from Chandrayaan-2 through instruments to the registration gap LunaMatch closes.
        </p>
      </GlassCard>

      <div className="space-y-5">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.kicker}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
          >
            <GlassCard className="space-y-3">
              <p className="kicker">{step.kicker}</p>
              <h2 className="text-2xl font-semibold">{step.title}</h2>
              <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{step.body}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

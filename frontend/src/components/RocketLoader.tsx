import { motion } from "framer-motion";
import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { GlassCard } from "./GlassCard";

const DEFAULT_TIPS = [
  "Bonus tip: CLAHE boosts local contrast tile-by-tile — crater rims appear without blowing out bright mare.",
  "Bonus tip: LoFTR-style matchers use dense attention cues, so they survive illumination swings that break SIFT/ORB.",
  "Bonus tip: RANSAC keeps the transform that the most matches agree with — outliers get discarded automatically.",
];

export function RocketLoader({
  title,
  tips = DEFAULT_TIPS,
}: {
  title: string;
  tips?: string[];
}) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 4000);
    return () => window.clearInterval(id);
  }, [tips.length]);

  return (
    <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--border)] bg-black/30 p-8">
      <motion.div
        className="absolute text-[var(--accent)]"
        animate={{
          x: ["-40vw", "40vw"],
          y: [30, -40, 20, -10, 30],
          rotate: [10, -8, 12, -5, 10],
        }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Rocket size={42} />
      </motion.div>
      <p className="mt-24 text-lg font-medium">{title}</p>
      <GlassCard className="mt-6 max-w-xl !p-4">
        <p className="kicker mb-2">While you wait</p>
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm leading-6 text-[var(--muted)]"
        >
          {tips[tipIndex]}
        </motion.p>
      </GlassCard>
    </div>
  );
}

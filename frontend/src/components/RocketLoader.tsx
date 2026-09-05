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
        className="absolute text-[var(--accent)] drop-shadow-[0_0_18px_rgba(88,224,208,0.45)]"
        animate={{
          x: ["-28vw", "28vw"],
          y: [24, -36, 18, -8, 24],
          rotate: [8, -6, 10, -4, 8],
        }}
        transition={{ duration: 4.6, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] }}
      >
        <Rocket size={42} />
      </motion.div>
      <motion.p
        className="mt-24 text-lg font-medium"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {title}
      </motion.p>
      <GlassCard className="mt-6 max-w-xl !p-4">
        <p className="kicker mb-2">While you wait</p>
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm leading-6 text-[var(--muted)]"
        >
          {tips[tipIndex]}
        </motion.p>
      </GlassCard>
    </div>
  );
}

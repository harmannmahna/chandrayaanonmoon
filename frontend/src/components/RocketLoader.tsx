import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 4200);
    return () => window.clearInterval(id);
  }, [tips.length]);

  return (
    <div className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--border)] bg-black/30 p-8">
      {!reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 50% 42%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)",
          }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.06, 1] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {!reduceMotion
        ? [0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/80"
              style={{ left: `${12 + i * 14}%`, top: `${18 + ((i * 17) % 55)}%` }}
              animate={{ opacity: [0.15, 0.95, 0.15], scale: [0.7, 1.35, 0.7] }}
              transition={{ duration: 2.2 + i * 0.35, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
            />
          ))
        : null}

      {!reduceMotion ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute h-px w-[70%] max-w-xl bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent)_55%,transparent)] to-transparent"
          style={{ top: "42%" }}
          animate={{ opacity: [0.15, 0.45, 0.15], scaleX: [0.85, 1.05, 0.85] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <motion.div
        className="relative z-[1] text-[var(--accent)] drop-shadow-[0_0_22px_rgba(88,224,208,0.55)]"
        animate={
          reduceMotion
            ? undefined
            : {
                x: ["-26vw", "26vw"],
                y: [28, -42, 10, -22, 28],
                rotate: [12, -8, 14, -6, 12],
                scale: [0.96, 1.05, 0.98, 1.04, 0.96],
              }
        }
        transition={{ duration: 5.2, repeat: Infinity, ease: [0.45, 0.05, 0.55, 0.95] }}
      >
        {!reduceMotion ? (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[78%] h-10 w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-[var(--accent)] to-transparent opacity-70 blur-[2px]"
            animate={{ opacity: [0.25, 0.85, 0.35], scaleY: [0.55, 1.25, 0.7], y: [0, 10, 4] }}
            transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <Rocket size={44} strokeWidth={1.75} />
      </motion.div>

      <motion.p
        className="relative z-[1] mt-28 text-lg font-medium tracking-tight"
        animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {title}
      </motion.p>

      <div className="relative z-[1] mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full w-1/3 rounded-full bg-[var(--accent)]"
          animate={reduceMotion ? { x: "100%" } : { x: ["-120%", "320%"] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <GlassCard className="relative z-[1] mt-6 max-w-xl !p-4">
        <p className="kicker mb-2">While you wait</p>
        <div className="relative min-h-[3.25rem]">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 text-sm leading-6 text-[var(--muted)]"
            >
              {tips[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </GlassCard>
    </div>
  );
}

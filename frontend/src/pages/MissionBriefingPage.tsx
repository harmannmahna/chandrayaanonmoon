import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";

type BriefingTopic = {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  details: string[];
  links?: { label: string; to: string }[];
};

const TOPICS: BriefingTopic[] = [
  {
    id: "mission",
    kicker: "01 · Mission",
    title: "Chandrayaan-2",
    summary:
      "ISRO’s orbiter keeps imaging the Moon — multi-resolution products that must be fused with heritage maps.",
    details: [
      "Chandrayaan-2’s orbiter continues science operations years after the landing attempt, returning optical and infrared coverage of the lunar surface.",
      "New frames rarely sit on the same grid as heritage maps from LRO (NASA) or SELENE/Kaguya (JAXA), so analysts must register them before change detection, landing-site work, or ice screening.",
      "LunaMatch focuses on that registration gap: make correspondence understandable stage by stage for Smart India Hackathon PS 26166.",
    ],
    links: [{ label: "Open registration wizard", to: "/register" }],
  },
  {
    id: "instruments",
    kicker: "02 · Instruments",
    title: "OHRC · TMC-2 · IIRS",
    summary:
      "Three modalities — morphology, stereo terrain, and spectral cues — that rarely share sun angle or pixel scale.",
    details: [
      "OHRC (Optical High Resolution Camera) captures fine surface morphology, including difficult lighting in and around permanently shadowed regions.",
      "TMC-2 (Terrain Mapping Camera-2) supports stereo elevation products — useful context for topography, but a different resolution and viewing geometry than OHRC.",
      "IIRS (Imaging Infrared Spectrometer) adds mineral and volatile-sensitive spectral information across wavelengths.",
      "Because these instruments differ in ground sample distance, look angle, and illumination, pixel-wise fusion without registration is unreliable.",
    ],
  },
  {
    id: "problem",
    kicker: "03 · The problem",
    title: "Why registration is hard",
    summary:
      "Illumination extremes, weak mare texture, scale gaps, and sparse overlap break naive matching.",
    details: [
      "Sun-angle changes create moving shadows and contrast reversals on crater walls — the same ridge can look unrelated across orbits.",
      "Mare plains are often low-texture, so classical detectors (SIFT/ORB-style) find few repeatable keypoints.",
      "Cross-mission pairs add scale and footprint mismatch; overlap may cover only part of the reference tile.",
      "LunaMatch’s response in this prototype: CLAHE for local contrast → LoFTR-style matching with weak-tile diagnostics → RANSAC geometric checks → a plain-language conclusion built from real metrics (not an LLM).",
    ],
    links: [{ label: "Run the pipeline", to: "/register" }],
  },
  {
    id: "lunamatch",
    kicker: "04 · LunaMatch",
    title: "What we provide",
    summary:
      "A judge-readable demo: enhance, match, verify, explain — plus an ice-screening path that needs registration first.",
    details: [
      "Stage 1 — CLAHE: boosts local contrast tile-by-tile so crater rims appear without washing out bright mare.",
      "Stage 2 — LoFTR-style adapter: dense-feeling matches with confidence scores; weak 3×3 regions get canned, tile-specific reasons (shadow, overlap, textureless mare, etc.).",
      "Stage 3 — RANSAC: keeps the transform most matches agree with and reports inliers, RMSE (pixel reprojection), coverage, rotation, and scale.",
      "Stage 4 — Plain-language conclusion: rule-based English filled from those metrics so judges can read the outcome without decoding matrices alone.",
      "Ice module: shows registration as the enabler for CPR/DOP-style screening (demo uses CPR > 1 and DOP < 0.13 thresholds; overlay rasters in the demo may be synthetic).",
    ],
    links: [
      { label: "Image registration", to: "/register" },
      { label: "Ice detection", to: "/ice" },
      { label: "Solar system explorer", to: "/solar" },
    ],
  },
];

export function MissionBriefingPage() {
  const [openId, setOpenId] = useState<string | null>("mission");

  const toggle = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="page space-y-6">
      <GlassCard>
        <p className="kicker">Context</p>
        <h1 className="mt-2 text-3xl font-semibold">Mission Briefing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Click a panel to expand — from Chandrayaan-2 and its instruments to the registration problem
          LunaMatch addresses.
        </p>
      </GlassCard>

      <div className="space-y-4">
        {TOPICS.map((topic, i) => {
          const open = openId === topic.id;
          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <GlassCard className={`overflow-hidden !p-0 ${open ? "ring-1 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]" : ""}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(topic.id)}
                  className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="kicker">{topic.kicker}</p>
                    <h2 className="text-2xl font-semibold">{topic.title}</h2>
                    {!open ? (
                      <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{topic.summary}</p>
                    ) : null}
                  </div>
                  <span
                    className={`mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--accent)] transition-transform duration-300 ${
                      open ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    <ChevronDown size={18} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-[var(--border)] px-5 pb-5 pt-4">
                        <ul className="space-y-3 text-sm leading-7 text-[var(--muted)]">
                          {topic.details.map((line) => (
                            <li key={line} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                        {topic.links?.length ? (
                          <div className="flex flex-wrap gap-3 pt-1">
                            {topic.links.map((link) => (
                              <Link key={link.to + link.label} to={link.to} className="btn btn-secondary !min-h-9 !px-3 text-xs">
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

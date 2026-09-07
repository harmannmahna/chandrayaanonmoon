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
      "LunaMatch’s response in this prototype: CLAHE for local contrast → AKAZE + ratio correspondence (LoFTR-ready interface) with weak-tile diagnostics → RANSAC geometric checks → a plain-language conclusion built from real metrics (not an LLM).",
    ],
    links: [{ label: "Run the pipeline", to: "/register" }],
  },
  {
    id: "lunamatch",
    kicker: "04 · LunaMatch",
    title: "What we provide",
    summary:
      "A judge-readable prototype: enhance, match, verify, explain — plus a polar mission-planning demo that needs optical context first.",
    details: [
      "Stage 1 — CLAHE: boosts local contrast tile-by-tile so crater rims appear without washing out bright mare.",
      "Stage 2 — Correspondence matching: AKAZE + Lowe-ratio adapter with confidence scores; weak 3×3 regions get tile-specific reasons (shadow, overlap, textureless mare, etc.). Same API shape stays LoFTR-ready for GPU weights later.",
      "Stage 3 — RANSAC: keeps the transform most matches agree with and reports inliers, RMSE (pixel reprojection), coverage, rotation, and scale.",
      "Stage 4 — Plain-language conclusion: rule-based English filled from those metrics so judges can read the outcome without decoding matrices alone.",
      "Ice module: polar mission-planning prototype on illustrative CPR/DOP layers (demo thresholds CPR > 1 and DOP < 0.13); optical Stages 1–2 share the registration upload/CLAHE path.",
    ],
    links: [
      { label: "Image registration", to: "/register" },
      { label: "Ice mission planner", to: "/ice" },
      { label: "Solar & illumination", to: "/solar" },
    ],
  },
  {
    id: "ice-context",
    kicker: "05 · LUNA/ICE",
    title: "Illustrative ice screening & mission planning",
    summary:
      "Prototype planner: CPR/DOP-threshold screening on demo layers → potential signatures → landing suitability → rover routes → scenario-based volume.",
    details: [
      "LUNA/ICE is a browser prototype polar mission planner: it applies radar-threshold logic to illustrative CPR/DOP layers, then ranks landing zones and plans terrain- and illumination-aware rover routes.",
      "Why it matters: lunar south-pole water ice may support science and ISRU; PSRs and doubly shadowed craters are important cold traps. Planning connects science targets with engineering constraints — planning support, not mission certification.",
      "CPR (Circular Polarization Ratio) and DOP (Degree of Polarization) are polarimetric cues. High CPR alone can also come from rough rocks, so the demo combines CPR and DOP and restricts candidates to a doubly-shadowed mask.",
      "Screening rule: IceCandidate = (CPR > 1.0) AND (DOP < 0.13) AND DoublyShadowedMask — an evidence-screening rule for radar-consistent candidates on the demo grid, not proof of confirmed ice.",
      "Workflow: upload/enhance optical context → illustrative crater radar/terrain layers → candidate screening & confidence → prototype landing candidates → A* route (science-first / solar-aware / battery-supported) → scenario-based volume (0–5 m depth) → ZIP export.",
      "Volume: V_ice = A_candidate × depth × iceFraction; M_ice = V_ice × 917 kg/m³. This is a scenario-based ice-volume estimate — assumptions do not measure actual depth or concentration.",
      "Exports include ice_candidate_mask.png, ice_confidence_map.png, landing_suitability_map.png, mission_map_overlay.png, recommended_landing_site.json, rover_route.geojson/csv, ice_volume_scenarios.json, mission_metrics.json, assumptions_and_limits.txt.",
      "Limits: illustrative/supplied demo layers (not calibrated DFSAR); never claims confirmed ice or guaranteed safe landing; not a full SAR/PDS/SPICE/DEM or certified rover nav suite.",
      "Real mission extension: calibrated DFSAR, polarimetry, OHRC + DTM/DEM hazards, illumination ray tracing, geodesy, rover dynamics/thermal models, independent validation.",
    ],
    links: [
      { label: "Open LUNA/ICE", to: "/ice" },
      { label: "Register", to: "/register" },
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
          Click a panel to expand — from Chandrayaan-2 and its instruments to registration and LUNA/ICE project details.
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

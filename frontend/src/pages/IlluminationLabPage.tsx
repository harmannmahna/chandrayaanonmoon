import { useState } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { MoonPhaseTab } from "../components/illumination/MoonPhaseTab";
import { CraterShadowSimulator } from "../components/illumination/CraterShadowSimulator";
import { SouthPoleSimulator } from "../components/illumination/SouthPoleSimulator";
import { ProjectRelevance } from "../components/illumination/ProjectRelevance";

const TABS = [
  { id: "phases", label: "Moon Phases" },
  { id: "crater", label: "Crater Shadows" },
  { id: "pole", label: "South Pole / Cold-Trap" },
  { id: "relevance", label: "Project Relevance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function IlluminationLabPage() {
  const [tab, setTab] = useState<TabId>("phases");

  return (
    <div className="page space-y-6">
      <GlassCard className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Lunar Illumination Explorer · Illumination Lab</p>
            <h1 className="mt-2 text-3xl font-semibold">Map sunlight. Understand shadows.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Educational visualization of sun-angle sensitivity for Moon phases, illustrative crater-shadow simulation,
              and solar-access / synthetic persistent-shadow proxies — context for Register and LUNA/ICE without changing
              their pipelines.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/solar" className="btn btn-secondary !min-h-9 text-xs">
              Back to Solar
            </Link>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Browser prototype · Illustrative synthetic simulations
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Illumination Lab tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`btn !min-h-9 text-xs ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {tab === "phases" ? <MoonPhaseTab /> : null}
      {tab === "crater" ? <CraterShadowSimulator /> : null}
      {tab === "pole" ? <SouthPoleSimulator /> : null}
      {tab === "relevance" ? <ProjectRelevance /> : null}

      <GlassCard className="space-y-2 text-xs leading-6 text-[var(--muted)]">
        <p className="kicker">Prototype assumptions and limits</p>
        <ul className="space-y-1">
          <li>• Moon phase and crater-shadow visuals are educational synthetic simulations.</li>
          <li>• No SPICE kernels, spacecraft ephemeris, calibrated OHRC/DFSAR data, lunar DEM, or official PSR map is used.</li>
          <li>• Moon phase is distinct from local polar terrain illumination.</li>
          <li>• Persistent shadow in this page is a synthetic proxy created by sampling simplified Sun directions.</li>
          <li>
            • Real mission analysis requires validated terrain data, long-duration illumination models, power/thermal
            constraints, and independent validation.
          </li>
          <li>• This page explains context for LUNA/REGISTER and LUNA/ICE; it does not alter their scientific outputs.</li>
        </ul>
      </GlassCard>
    </div>
  );
}

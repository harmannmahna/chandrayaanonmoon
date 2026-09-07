import { Link } from "react-router-dom";
import { GlassCard } from "../../components/GlassCard";

export function IceContextPage() {
  return (
    <div className="page space-y-6">
      <GlassCard className="space-y-3">
        <p className="kicker">LUNA/ICE · Context</p>
        <h1 className="text-3xl font-semibold">Radar-consistent ice screening & mission planning</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          LUNA/ICE converts radar-derived CPR and DOP evidence into an explainable map of potential subsurface-ice
          signatures, then ranks landing zones and plans terrain- and illumination-aware rover routes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/ice" className="btn btn-primary">
            Open LUNA/ICE
          </Link>
          <Link to="/register" className="btn btn-secondary">
            LUNA/REGISTER
          </Link>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Why it matters</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Lunar south-pole water ice may support future science and ISRU. Permanently shadowed regions and doubly
          shadowed craters are important cold-trap environments. Planning requires connecting scientific target evidence
          with engineering constraints — landing suitability and rover traverse — as planning support, not mission
          certification.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Radar evidence</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          <strong className="text-[var(--text)]">CPR</strong> (Circular Polarization Ratio) and{" "}
          <strong className="text-[var(--text)]">DOP</strong> (Degree of Polarization) are polarimetric cues. High CPR
          alone can also come from rough rocks, so we combine CPR and DOP and restrict candidates to a doubly-shadowed
          mask.
        </p>
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--accent)]">
          IceCandidate = (CPR &gt; 1.0) AND (DOP &lt; 0.13) AND DoublyShadowedMask
        </p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          This is an evidence-screening rule for radar-consistent ice candidates — not proof of confirmed ice.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Prototype workflow</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">
          <li>Upload / enhance optical context (Stages 1–2).</li>
          <li>Load illustrative doubly-shadowed crater radar/terrain demo layers.</li>
          <li>Run ice analysis → ice candidate clusters + ice-evidence confidence.</li>
          <li>Find prototype landing candidates.</li>
          <li>Plan A* rover route (science-first / solar-aware / battery-supported).</li>
          <li>Scenario-based ice-volume estimate (0–5 m assumed depth).</li>
          <li>Export mission-planning package.</li>
        </ol>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Volume assumptions</p>
        <p className="font-mono text-xs text-[var(--accent)]">V_ice = A_candidate × depth × iceFraction</p>
        <p className="font-mono text-xs text-[var(--accent)]">M_ice = V_ice × 917 kg/m³</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Volume is based on assumptions and does not directly measure actual depth or concentration. Prefer the phrase
          scenario-based ice-volume estimate.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Outputs</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          ice_candidate_mask.png, ice_confidence_map.png, landing_suitability_map.png, mission_map_overlay.png,
          recommended_landing_site.json, rover_route.geojson / .csv, ice_volume_scenarios.json, mission_metrics.json,
          assumptions_and_limits.txt — bundled as a ZIP mission package.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Scientific limitations</p>
        <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
          <li>Illustrative / supplied demo layers — not calibrated Chandrayaan-2 DFSAR.</li>
          <li>Never claims confirmed ice, discovered ice, or guaranteed safe landing.</li>
          <li>Not a raw SAR polarimetry suite, PDS .IMG pipeline, SPICE/DEM geodesy system, or certified rover nav.</li>
          <li>Landing/route results are prototype planning scenarios only.</li>
        </ul>
      </GlassCard>

      <GlassCard className="space-y-3">
        <p className="kicker">Real mission-data extension path</p>
        <p className="text-sm leading-7 text-[var(--muted)]">
          Calibrated DFSAR ingestion · polarimetric processing · OHRC and DTM/DEM hazard extraction · illumination ray
          tracing · geodetic coordinates · rover dynamics/thermal models · independent scientific validation. Optional
          AI-ready modular architecture for learned terrain/hazard extensions.
        </p>
      </GlassCard>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { RocketLoader } from "../components/RocketLoader";
import { runIce, type IceResponse } from "../api/client";

const ICE_TIPS = [
  "Bonus tip: CPR > 1 alone is not enough — rocky clutter can raise circular polarization.",
  "Bonus tip: DOP < 0.13 gates out depolarized returns from rough surfaces, leaving ice-like candidates.",
  "Bonus tip: Registration is the enabler: DFSAR and OHRC must share a pixel grid before overlays matter.",
];

export function IceDetectionPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IceResponse | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await runIce());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ice detection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page space-y-6">
      <GlassCard className="space-y-3">
        <p className="kicker">Option B · Downstream PS</p>
        <h1 className="text-3xl font-semibold">Subsurface Ice Detection</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          Registration is the enabler for ice prospecting: DFSAR radar and OHRC optical must be
          pixel-aligned before CPR / DOP overlays can be trusted. Candidates require{" "}
          <strong className="text-[var(--text)]">CPR &gt; 1</strong> and{" "}
          <strong className="text-[var(--text)]">DOP &lt; 0.13</strong>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run()}>
            Run ice screening
          </button>
          <Link to="/register" className="btn btn-secondary">
            Open registration first
          </Link>
        </div>
      </GlassCard>

      {error ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {busy ? <RocketLoader title="Screening permanently shadowed regions…" tips={ICE_TIPS} /> : null}

      {!busy && result ? (
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <p className="kicker">Criteria · {result.criteria}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <figure>
                <img
                  src={result.optical_url}
                  alt="Optical context"
                  className="w-full rounded-2xl border border-[var(--border)]"
                />
                <figcaption className="mt-2 text-xs text-[var(--muted)]">Optical context</figcaption>
              </figure>
              <figure>
                <img
                  src={result.overlay_url}
                  alt="Ice overlay"
                  className="w-full rounded-2xl border border-[var(--border)]"
                />
                <figcaption className="mt-2 text-xs text-[var(--muted)]">
                  Overlay · cyan = CPR-only · lime = CPR+DOP candidates
                </figcaption>
              </figure>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <p className="kicker">Est. ice volume</p>
                <p className="mt-2 text-lg font-medium">
                  {result.estimated_ice_volume_m3.toLocaleString()} m³
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <p className="kicker">Candidate pixels</p>
                <p className="mt-2 text-lg font-medium">{result.candidate_pixels.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
                <p className="kicker">Landing path</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">in progress</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="kicker">Detected regions</p>
            {result.regions.map((r) => (
              <div key={r.name} className="rounded-2xl border border-[var(--border)] p-4 text-sm leading-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{r.name}</strong>
                  <span className="text-xs uppercase tracking-wider text-[var(--accent)]">
                    {r.confidence} confidence
                  </span>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  mean CPR {r.mean_cpr} · mean DOP {r.mean_dop} · bbox [{r.bbox.join(", ")}]
                </p>
              </div>
            ))}
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="kicker">Terrain note · OHRC morphology</p>
            <p className="text-sm leading-7 text-[var(--muted)]">{result.terrain_note}</p>
            <p className="text-sm leading-7">{result.relevance}</p>
            <p className="rounded-xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
              Landing path status: {result.landing_path_status}
            </p>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}

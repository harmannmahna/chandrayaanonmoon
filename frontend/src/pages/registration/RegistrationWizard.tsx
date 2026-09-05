import { useMemo, useState } from "react";
import { GlassCard } from "../../components/GlassCard";
import { RocketLoader } from "../../components/RocketLoader";
import { BeforeAfterSlider } from "../../components/BeforeAfterSlider";
import { loadDemo, runClahe, runLoftr, runRansac, uploadImages } from "../../api/client";

type Stage = "select" | "clahe" | "loftr" | "ransac" | "done";

const CLAHE_TIPS = [
  "Bonus tip: CLAHE boosts local contrast tile-by-tile — crater rims appear without washing out bright mare.",
  "Bonus tip: Unlike global equalization, CLAHE clips the histogram first so flat terrain noise is not over-amplified.",
];
const LOFTR_TIPS = [
  "Bonus tip: LoFTR-style matching uses attention cues, surviving illumination swings that break SIFT/ORB.",
  "Bonus tip: Low-confidence tiles usually mean deep shadow, missing overlap, or textureless mare.",
];
const RANSAC_TIPS = [
  "Bonus tip: RANSAC keeps the transform most matches agree with — outliers are discarded automatically.",
  "Bonus tip: RMSE here is pixel reprojection error on inliers, not lunar geodetic accuracy.",
];

export function RegistrationWizard() {
  const [count, setCount] = useState(2);
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clahe, setClahe] = useState<Awaited<ReturnType<typeof runClahe>> | null>(null);
  const [loftr, setLoftr] = useState<Awaited<ReturnType<typeof runLoftr>> | null>(null);
  const [ransac, setRansac] = useState<Awaited<ReturnType<typeof runRansac>> | null>(null);
  const [showHInfo, setShowHInfo] = useState(false);

  const ready = useMemo(() => files.every(Boolean), [files]);

  const setSlotCount = (n: number) => {
    setCount(n);
    setFiles(Array.from({ length: n }, (_, i) => files[i] ?? null));
    setPreviews(Array.from({ length: n }, (_, i) => previews[i] ?? null));
  };

  const onFile = (index: number, file: File | null) => {
    const nextFiles = [...files];
    const nextPreviews = [...previews];
    nextFiles[index] = file;
    nextPreviews[index] = file ? URL.createObjectURL(file) : null;
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  const startDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const demo = await loadDemo();
      setJobId(demo.job_id);
      setCount(demo.count);
      setPreviews(demo.preview_urls);
      setFiles(Array.from({ length: demo.count }, () => new File([], "demo.png")));
      setStage("clahe");
      const result = await runClahe(demo.job_id);
      setClahe(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo failed");
      setStage("select");
    } finally {
      setBusy(false);
    }
  };

  const startUpload = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadImages(files.filter(Boolean) as File[], 0);
      setJobId(uploaded.job_id);
      setStage("clahe");
      const result = await runClahe(uploaded.job_id);
      setClahe(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStage("select");
    } finally {
      setBusy(false);
    }
  };

  const goLoftr = async () => {
    if (!jobId) return;
    setStage("loftr");
    setBusy(true);
    setError(null);
    try {
      setLoftr(await runLoftr(jobId, Math.min(1, count - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matching failed");
    } finally {
      setBusy(false);
    }
  };

  const goRansac = async () => {
    if (!jobId) return;
    setStage("ransac");
    setBusy(true);
    setError(null);
    try {
      setRansac(await runRansac(jobId));
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "RANSAC failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page space-y-6">
      <GlassCard>
        <p className="kicker">Option A · Core PS flow</p>
        <h1 className="mt-2 text-3xl font-semibold">Image Registration Wizard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          CLAHE → LoFTR-style matching → RANSAC, with animations and plain-language diagnostics.
        </p>
      </GlassCard>

      {error ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {stage === "select" ? (
        <GlassCard className="space-y-5">
          <div>
            <p className="kicker">How many images?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`btn ${count === n ? "btn-primary" : "btn-secondary"}`} onClick={() => setSlotCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
              <label key={i} className="flex min-h-48 cursor-pointer flex-col rounded-2xl border border-dashed border-[var(--border)] bg-black/20 p-4">
                <span className="kicker">{i === 0 ? "Reference (LRO / SELENE)" : `Source ${i} (Ch-2)`}</span>
                <div className="mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
                  {previews[i] ? <img src={previews[i]!} alt="" className="h-40 w-full object-cover grayscale" /> : <span className="text-sm text-[var(--muted)]">Drop / browse</span>}
                </div>
                <input className="mt-3 text-xs" type="file" accept="image/*" onChange={(e) => onFile(i, e.target.files?.[0] ?? null)} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={() => void startUpload()}>Start Processing</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startDemo()}>Load demo pair</button>
          </div>
        </GlassCard>
      ) : null}

      {stage === "clahe" && busy ? <RocketLoader title="Enhancing your images…" tips={CLAHE_TIPS} /> : null}
      {stage === "clahe" && !busy && clahe ? (
        <GlassCard className="space-y-4">
          <p className="kicker">Stage 1 · CLAHE result</p>
          <div className="grid gap-4 md:grid-cols-2">
            {clahe.images.map((src, i) => (
              <div key={src}>
                <BeforeAfterSlider beforeSrc={clahe.originals[i]} afterSrc={src} />
                <p className="mt-2 text-xs text-[var(--muted)]">{clahe.notes[i]?.note}</p>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void goLoftr()}>Next · Find matches</button>
        </GlassCard>
      ) : null}

      {stage === "loftr" && busy ? <RocketLoader title="Finding matching points…" tips={LOFTR_TIPS} /> : null}
      {stage === "loftr" && !busy && loftr ? (
        <GlassCard className="space-y-4">
          <p className="kicker">Stage 2 · LoFTR-style matching</p>
          <img src={loftr.preview_url} alt="Matches" className="w-full rounded-2xl border border-[var(--border)]" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Matches" value={String(loftr.num_matches)} />
            <Metric label="Mean confidence" value={`${(loftr.mean_confidence * 100).toFixed(1)}%`} />
            <Metric label="Matcher" value="LoFTR-style" tip={loftr.matcher} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] p-4">
            <p className="kicker">Why is confidence low?</p>
            <div className="mt-3 space-y-3">
              {loftr.weak_regions.length ? loftr.weak_regions.map((r) => (
                <div key={r.pixel_range} className="text-sm leading-6 text-[var(--muted)]">
                  <strong className="text-[var(--text)]">{r.pixel_range}</strong> · {r.match_count} matches · {(r.mean_confidence * 100).toFixed(0)}% · {r.reason}
                </div>
              )) : <p className="text-sm text-[var(--muted)]">No weak tiles flagged.</p>}
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void goRansac()}>Next · Align with RANSAC</button>
        </GlassCard>
      ) : null}

      {stage === "ransac" && busy ? <RocketLoader title="Aligning your images…" tips={RANSAC_TIPS} /> : null}

      {stage === "done" && ransac ? (
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <p className="kicker">Stage 3 · RANSAC geometric verification</p>
            <div className="grid gap-4 md:grid-cols-2">
              <figure>
                <img src={ransac.overlay_url} alt="Blend" className="w-full rounded-2xl border border-[var(--border)]" />
                <figcaption className="mt-2 text-xs text-[var(--muted)]">50/50 blend overlay</figcaption>
              </figure>
              <figure>
                <img src={ransac.tint_overlay_url} alt="Tint" className="w-full rounded-2xl border border-[var(--border)]" />
                <figcaption className="mt-2 text-xs text-[var(--muted)]">Cyan reference + yellow warped source</figcaption>
              </figure>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Spatial coverage" value={`${(ransac.spatial_coverage * 100).toFixed(0)}%`} tip="Share of reference tiles containing inliers." />
              <Metric label="Inlier ratio" value={`${(ransac.inlier_ratio * 100).toFixed(1)}%`} tip="Matches agreeing with the homography." />
              <Metric label="Inlier count" value={String(ransac.inlier_count)} />
              <Metric label="RMSE (px)" value={ransac.rmse_px.toFixed(2)} tip="Pixel reprojection error on inliers." />
              <Metric label="Transform H" value="3×3 matrix" action={() => setShowHInfo(true)} />
              <Metric label="Δ rot / scale" value={`${ransac.rotation_deg.toFixed(1)}° / ${ransac.scale.toFixed(2)}×`} />
            </div>
            {showHInfo ? (
              <div className="rounded-2xl border border-[var(--border)] bg-black/30 p-4 text-sm leading-6">
                <p className="kicker mb-2">What is the transformation matrix?</p>
                <p className="text-[var(--muted)]">This 3×3 homography is the recipe that rotates, scales, shifts and skews the source into the reference frame.</p>
                <pre className="mt-3 overflow-auto text-xs text-[var(--accent)]">{ransac.H.map((row) => row.map((v) => v.toFixed(4)).join("  ")).join("\n")}</pre>
                <button type="button" className="btn btn-secondary mt-3" onClick={() => setShowHInfo(false)}>Close</button>
              </div>
            ) : null}
          </GlassCard>
          <GlassCard>
            <p className="kicker">Stage 4 · Plain-language conclusion</p>
            <p className="mt-3 text-base leading-8">{ransac.conclusion}</p>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tip, action }: { label: string; value: string; tip?: string; action?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">{label}</p>
        {action ? (
          <button type="button" className="text-xs text-[var(--accent)]" onClick={action} aria-label={`Info about ${label}`}>
            (i)
          </button>
        ) : tip ? (
          <button
            type="button"
            className="text-xs text-[var(--muted)]"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Tip about ${label}`}
          >
            (i)
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-lg font-medium">{value}</p>
      {open && tip ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{tip}</p> : null}
    </div>
  );
}

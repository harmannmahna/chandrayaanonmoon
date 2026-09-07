import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Info } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { RocketLoader } from "../../components/RocketLoader";
import { BeforeAfterSlider } from "../../components/BeforeAfterSlider";
import { apiHealth, loadDemo, runClahe, runLoftr, runRansac, uploadImages } from "../../api/client";
import { useAppStore } from "../../store/appStore";

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

const RMSE_GUIDE = [
  { rmse: 10, meaning: "Poor alignment" },
  { rmse: 5, meaning: "Moderate" },
  { rmse: 2, meaning: "Good" },
  { rmse: 0.8, meaning: "Very good" },
  { rmse: 0.1, meaning: "Extremely precise" },
] as const;

function nearestRmseGuide(rmse: number): number {
  let best: number = RMSE_GUIDE[0].rmse;
  for (const row of RMSE_GUIDE) {
    if (Math.abs(row.rmse - rmse) < Math.abs(best - rmse)) best = row.rmse;
  }
  return best;
}

function isImageFile(file: File | undefined | null): file is File {
  if (!file) return false;
  if (file.type.startsWith("image/")) return true;
  // Some OS drag payloads omit MIME — fall back to extension.
  return /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(file.name);
}

export function RegistrationWizard() {
  const setLastRegistrationJobId = useAppStore((s) => s.setLastRegistrationJobId);
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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragDepth = useRef<Record<number, number>>({});

  const ready = useMemo(() => files.every(Boolean), [files]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiHealth().then((ok) => {
      if (!cancelled) setApiOnline(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSlotCount = (n: number) => {
    setCount(n);
    setFiles(Array.from({ length: n }, (_, i) => files[i] ?? null));
    setPreviews(Array.from({ length: n }, (_, i) => previews[i] ?? null));
  };

  const onFile = (index: number, file: File | null) => {
    if (file && !isImageFile(file)) {
      setError("Please drop an image file (PNG, JPG, WEBP, …).");
      return;
    }
    setError(null);
    setFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!);
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  };

  const onDragEnter = (index: number, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current[index] = (dragDepth.current[index] ?? 0) + 1;
    setDragOverIndex(index);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (index: number, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current[index] = Math.max(0, (dragDepth.current[index] ?? 0) - 1);
    if ((dragDepth.current[index] ?? 0) === 0) {
      setDragOverIndex((cur) => (cur === index ? null : cur));
    }
  };

  const onDrop = (index: number, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current[index] = 0;
    setDragOverIndex(null);
    const list = e.dataTransfer?.files;
    if (!list?.length) return;
    const image = Array.from(list).find((f) => isImageFile(f)) ?? null;
    onFile(index, image);
  };

  const startDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const demo = await loadDemo();
      setApiOnline(true);
      setJobId(demo.job_id);
      setLastRegistrationJobId(demo.job_id);
      setCount(demo.count);
      setPreviews(demo.preview_urls);
      // Placeholder files so the upload CTA stays consistent; demo uses job_id on the server.
      setFiles(
        Array.from({ length: demo.count }, (_, i) => new File([`demo-${i}`], `demo_${i + 1}.png`, { type: "image/png" })),
      );
      setStage("clahe");
      const result = await runClahe(demo.job_id);
      setClahe(result);
    } catch (e) {
      setApiOnline(false);
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
      setLastRegistrationJobId(uploaded.job_id);
      setStage("clahe");
      const result = await runClahe(uploaded.job_id);
      setClahe(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(
        /failed to fetch|failed to reach|networkerror/i.test(msg)
          ? "Cannot reach the API. Open http://127.0.0.1:8000/register (Python 3.11 backend must be running on port 8000), then try Start Processing again."
          : msg,
      );
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

      {apiOnline === false && !error ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]">
          Cannot reach the LunaMatch API. Start the backend with
          {" "}
          <code className="rounded bg-black/30 px-1">uvicorn main:app --host 0.0.0.0 --port 8000</code>
          {" "}
          then refresh this page.
        </div>
      ) : null}

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
            {Array.from({ length: count }).map((_, i) => {
              const active = dragOverIndex === i;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      document.getElementById(`slot-file-${i}`)?.click();
                    }
                  }}
                  onClick={() => document.getElementById(`slot-file-${i}`)?.click()}
                  onDragEnter={(e) => onDragEnter(i, e)}
                  onDragOver={onDragOver}
                  onDragLeave={(e) => onDragLeave(i, e)}
                  onDrop={(e) => onDrop(i, e)}
                  className={`flex min-h-48 cursor-pointer flex-col rounded-2xl border border-dashed p-4 transition ${
                    active
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
                      : "border-[var(--border)] bg-black/20"
                  }`}
                >
                  <span className="kicker">{i === 0 ? "Reference (LRO / SELENE)" : `Source ${i} (Ch-2)`}</span>
                  <div className="pointer-events-none mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
                    {previews[i] ? (
                      <img src={previews[i]!} alt="" className="h-40 w-full object-cover grayscale" />
                    ) : (
                      <span className="px-3 text-center text-sm text-[var(--muted)]">
                        {active ? "Release to drop image" : "Drag & drop image here, or click to browse"}
                      </span>
                    )}
                  </div>
                  <input
                    id={`slot-file-${i}`}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onFile(i, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  {files[i] ? (
                    <p className="mt-3 truncate text-xs text-[var(--muted)]">{files[i]!.name || "Image selected"}</p>
                  ) : null}
                </div>
              );
            })}
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
                <BeforeAfterSlider
                  beforeSrc={clahe.originals[i]}
                  afterSrc={src}
                  beforeLabel="Original"
                  afterLabel="Enhanced"
                />
                <p className="mt-2 text-xs text-[var(--muted)]">{clahe.notes[i]?.note}</p>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void goLoftr()}>Next · Find matches</button>
        </GlassCard>
      ) : null}

      {stage === "loftr" && busy ? <RocketLoader title="Finding matching points…" tips={LOFTR_TIPS} /> : null}
      {stage === "loftr" && !busy && loftr ? (
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <p className="kicker">Stage 2 · LoFTR-style matching</p>
            <img src={loftr.preview_url} alt="Matches" className="w-full rounded-2xl border border-[var(--border)]" />
            <p className="text-xs text-[var(--muted)]">
              <span className="mr-3 inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> Green = matched</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Red = unmatched</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Total keypoints"
                value={String(loftr.total_keypoints_evaluated ?? (loftr.num_matches + (loftr.num_unmatched ?? 0)))}
                tip="All keypoints detected on both images before the match/unmatch split."
              />
              <Metric
                label="Matched (green)"
                value={String(loftr.num_matches)}
                tip="Keypoints that passed the Lowe ratio test — shown in green."
              />
              <Metric
                label="Matched confidence"
                value={`${((loftr.matched_mean_confidence ?? loftr.mean_confidence) * 100).toFixed(1)}%`}
                tip="Mean confidence of matched (green) keypoints only — unmatched/red points are excluded from this average."
              />
              <Metric label="Matcher" value="LoFTR-style" tip={loftr.matcher} />
            </div>
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <p className="kicker">Why is confidence low?</p>
              <div className="mt-3 space-y-3">
                {loftr.weak_regions.length ? loftr.weak_regions.map((r) => (
                  <div key={r.pixel_range} className="text-sm leading-6 text-[var(--muted)]">
                    <strong className="text-[var(--text)]">{r.pixel_range}</strong> · {r.match_count} matched · {(r.mean_confidence * 100).toFixed(0)}% matched conf · {r.reason}
                  </div>
                )) : <p className="text-sm text-[var(--muted)]">No weak tiles flagged.</p>}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <p className="kicker">Unmatched points on the moon</p>
            <p className="text-sm text-[var(--muted)]">
              Keypoints detected on the reference scene that did not find a reliable partner in the source image
              {typeof loftr.num_unmatched === "number" ? ` (${loftr.num_unmatched} total across both views)` : ""}.
            </p>
            {loftr.unmatched_preview_url ? (
              <img
                src={loftr.unmatched_preview_url}
                alt="Unmatched points on the moon"
                className="w-full rounded-2xl border border-[var(--border)]"
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">No unmatched preview available for this run.</p>
            )}
          </GlassCard>

          <button type="button" className="btn btn-primary" onClick={() => void goRansac()}>Next · Align with RANSAC</button>
        </div>
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
          <GlassCard className="space-y-4">
            <p className="kicker">Stage 4 · Plain-language conclusion</p>
            <p className="mt-1 text-base leading-8">{ransac.conclusion}</p>

            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-2 border-b border-[var(--border)] bg-black/30 px-4 py-2.5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                <span>RMSE</span>
                <span>Meaning</span>
              </div>
              {RMSE_GUIDE.map((row) => {
                const active = nearestRmseGuide(ransac.rmse_px) === row.rmse;
                return (
                  <div
                    key={row.rmse}
                    className={`grid grid-cols-2 border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0 ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-semibold text-[var(--text)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    <span>{row.rmse} px</span>
                    <span className="flex items-center justify-between gap-2">
                      <span>{row.meaning}</span>
                      {active ? (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--accent)]">
                          your result · {ransac.rmse_px.toFixed(1)} px
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs leading-5 text-[var(--muted)]">
              Guide values are reference levels for reading RMSE. Your measured inlier reprojection error is highlighted.
            </p>
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
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
            onClick={action}
            aria-label={`Info about ${label}`}
          >
            <Info size={14} strokeWidth={2.25} />
          </button>
        ) : tip ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--accent)]"
            onClick={() => setOpen((v) => !v)}
            aria-label={`Tip about ${label}`}
          >
            <Info size={14} strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-lg font-medium">{value}</p>
      {open && tip ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{tip}</p> : null}
    </div>
  );
}

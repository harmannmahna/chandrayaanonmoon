import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Info } from "lucide-react";
import { GlassCard } from "../../components/GlassCard";
import { RocketLoader } from "../../components/RocketLoader";
import { BeforeAfterSlider } from "../../components/BeforeAfterSlider";
import { apiHealth, listMatchers, loadDemo, runClahe, runLoftr, runRansac, uploadImages } from "../../api/client";
import { useAppStore } from "../../store/appStore";
import { ModelSelector } from "../../components/mission/ModelSelector";
import { LineagePanel } from "../../components/mission/LineagePanel";
import { ReliabilityPanel } from "../../components/mission/ReliabilityPanel";
import { LunaGuidePanel } from "../../components/mission/LunaGuidePanel";
import { ExperimentDrawer } from "../../components/mission/ExperimentDrawer";
import { ProcessingStatus } from "../../components/mission/ProcessingStatus";
import { PlatformProjectBar } from "../../components/mission/PlatformProjectBar";
import { exportAllRunsJson, exportRunJson, loadRuns, newRunId, saveRun } from "../../lib/mission/runHistory";
import type { LineageStep, MatcherEngine, MatcherEngineInfo, RunRecord } from "../../lib/mission/types";
import {
  getRegistrationResults,
  getRegistrationRun,
  pollUntil,
  startRegistrationRun,
  uploadDatasetFile,
  createExport,
  getExport,
  type AnalysisRun,
} from "../../api/platform";

type Stage = "select" | "clahe" | "loftr" | "ransac" | "done";

const CLAHE_TIPS = [
  "Bonus tip: CLAHE boosts local contrast tile-by-tile — crater rims appear without washing out bright mare.",
  "Bonus tip: Unlike global equalization, CLAHE clips the histogram first so flat terrain noise is not over-amplified.",
];
const LOFTR_TIPS = [
  "Bonus tip: Choose AKAZE (classical) or optional AI engines — unavailable AI models never invent matches.",
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

/** Compact readable formatting for homography entries (keeps tiny perspective terms visible). */
function formatHomographyValue(v: number): string {
  const abs = Math.abs(v);
  if (abs !== 0 && abs < 1e-3) return v.toExponential(2);
  if (abs >= 100) return v.toFixed(2);
  return v.toFixed(4);
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function isImageFile(file: File | undefined | null): file is File {
  if (!file) return false;
  if (file.type.startsWith("image/")) return true;
  // Some OS drag payloads omit MIME — fall back to extension.
  return /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(file.name);
}

export function RegistrationWizard() {
  const setLastRegistrationJobId = useAppStore((s) => s.setLastRegistrationJobId);
  const workspaceMode = useAppStore((s) => s.workspaceMode);
  const projectId = useAppStore((s) => s.projectId);
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
  const [engine, setEngine] = useState<MatcherEngine>("akaze");
  const [engines, setEngines] = useState<MatcherEngineInfo[]>([]);
  const [enginesLoading, setEnginesLoading] = useState(true);
  const [lineageOpen, setLineageOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>(() => loadRuns());
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [processStep, setProcessStep] = useState(0);
  const [inputDataStatus, setInputDataStatus] = useState("awaiting input");
  const [serverRun, setServerRun] = useState<AnalysisRun | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const ready = useMemo(() => files.every(Boolean), [files]);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiHealth().then((ok) => {
      if (!cancelled) setApiOnline(ok);
    });
    void listMatchers()
      .then((res) => {
        if (!cancelled) setEngines(res.engines as MatcherEngineInfo[]);
      })
      .catch(() => {
        if (!cancelled) {
          setEngines([
            {
              engine: "akaze",
              label: "Classical Baseline",
              ui_label: "AKAZE",
              description: "Always available",
              available: true,
              status: "available",
            },
            {
              engine: "superpoint-lightglue",
              label: "AI Fast",
              ui_label: "SuperPoint + LightGlue",
              description: "Optional",
              available: false,
              status: "unavailable",
            },
            {
              engine: "loftr",
              label: "AI Robust",
              ui_label: "LoFTR",
              description: "Optional",
              available: false,
              status: "unavailable",
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setEnginesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lineageSteps: LineageStep[] = useMemo(() => {
    const matchDetail =
      loftr?.fallback_used
        ? `Fallback used → ${loftr.engine ?? "akaze"}`
        : loftr
          ? `${loftr.engine ?? engine} · ${loftr.num_matches} matches`
          : engine;
    return [
      { id: "input", label: "Input", status: files.some(Boolean) || jobId ? "done" : "pending", detail: inputDataStatus },
      { id: "pre", label: "Preprocessing (CLAHE)", status: clahe ? "done" : stage === "clahe" && busy ? "active" : "pending" },
      {
        id: "model",
        label: "Model matching",
        status: loftr ? "done" : stage === "loftr" && busy ? "active" : "pending",
        detail: matchDetail,
      },
      {
        id: "geom",
        label: "Geometry verification (RANSAC)",
        status: ransac ? "done" : stage === "ransac" && busy ? "active" : "pending",
      },
      {
        id: "audit",
        label: "Confidence audit",
        status: ransac?.reliability ? "done" : stage === "done" ? "active" : "pending",
        detail: ransac?.reliability?.trust_label,
      },
      {
        id: "out",
        label: "Output",
        status: stage === "done" && ransac ? "done" : "pending",
        detail: stage === "done" ? "Overlay + metrics + experiment record" : undefined,
      },
    ];
  }, [busy, clahe, engine, files, inputDataStatus, jobId, loftr, ransac, stage]);

  const recordExperiment = (match: NonNullable<typeof loftr>, geom: NonNullable<typeof ransac>, jid: string) => {
    const run: RunRecord = {
      id: newRunId(),
      timestamp: new Date().toISOString(),
      inputPair: {
        jobId: jid,
        sourceIndex: Math.min(1, count - 1),
        inputDataStatus,
        count,
      },
      engineRequested: engine,
      engineUsed: (geom.engine || match.engine || engine) as string,
      fallbackUsed: Boolean(geom.fallback_used || match.fallback_used),
      preprocessing: { clahe: true },
      ransacParams: { reprojThresholdPx: 3, note: "OpenCV RANSAC default threshold in pipeline" },
      matchStats: {
        rawMatches: geom.raw_match_count ?? match.num_matches,
        meanConfidence: match.matched_mean_confidence ?? match.mean_confidence,
        runtimeMs: match.runtime_ms ?? geom.runtime_ms_match,
        matcherLabel: match.matcher,
      },
      metrics: {
        inlierCount: geom.inlier_count,
        inlierRatio: geom.inlier_ratio,
        rmsePx: geom.rmse_px,
        spatialCoverage: geom.spatial_coverage,
        rotationDeg: geom.rotation_deg,
        scale: geom.scale,
      },
      quality: geom.reliability
        ? {
            score: geom.reliability.score,
            trust_label: geom.reliability.trust_label,
            reasons: geom.reliability.reasons,
            limitation: geom.reliability.limitation,
          }
        : null,
      outputStatus: "complete",
      previewUrls: {
        matches: match.preview_url,
        unmatched: match.unmatched_preview_url,
        overlay: geom.overlay_url,
        tint: geom.tint_overlay_url,
      },
    };
    setRuns(saveRun(run));
  };

  useEffect(() => {
    const onEngine = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail === "akaze" || detail === "superpoint-lightglue" || detail === "loftr") {
        setEngine(detail);
        setStage("select");
      }
    };
    const onHistory = () => setHistoryOpen(true);
    const onExplain = () => {
      setHistoryOpen(false);
      window.setTimeout(() => guideRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    };
    const onExport = () => {
      const latest = loadRuns()[0];
      if (latest) exportRunJson(latest);
      else {
        const all = loadRuns();
        if (all.length) exportAllRunsJson(all);
        else setError("No experiment runs to export yet — complete Register through RANSAC first.");
      }
      setHistoryOpen(true);
    };
    document.addEventListener("lunamatch:engine", onEngine as EventListener);
    document.addEventListener("lunamatch:open-history", onHistory);
    document.addEventListener("lunamatch:explain", onExplain);
    document.addEventListener("lunamatch:export", onExport);
    return () => {
      document.removeEventListener("lunamatch:engine", onEngine as EventListener);
      document.removeEventListener("lunamatch:open-history", onHistory);
      document.removeEventListener("lunamatch:explain", onExplain);
      document.removeEventListener("lunamatch:export", onExport);
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

  const mapEngineForPlatform = (e: MatcherEngine) => e.replace(/-/g, "_");

  const runPlatformRegistration = async (pair: File[], dataStatus: string) => {
    if (!projectId) throw new Error("Create or select a platform project first.");
    setInputDataStatus(dataStatus);
    setProcessStep(0);
    setStage("loftr");
    const refDs = await uploadDatasetFile(projectId, pair[0]!, { dataStatus });
    setProcessStep(1);
    const srcDs = await uploadDatasetFile(projectId, pair[1]!, { dataStatus });
    setProcessStep(1);
    const run = await startRegistrationRun({
      project_id: projectId,
      reference_dataset_id: refDs.id,
      source_dataset_id: srcDs.id,
      engine: mapEngineForPlatform(engine),
      allow_fallback: true,
    });
    setServerRun(run);
    setJobId(run.id);
    setLastRegistrationJobId(run.id);
    setProcessStep(2);
    const finished = await pollUntil(
      async () => {
        const r = await getRegistrationRun(run.id);
        setServerRun(r);
        if (r.status === "preprocessing") setProcessStep(0);
        if (r.status === "matching") setProcessStep(1);
        if (r.status === "ransac") setProcessStep(2);
        if (r.status === "refinement") setProcessStep(3);
        if (r.status === "exporting") setProcessStep(4);
        return r;
      },
      (r) => r.status === "completed" || r.status === "failed" || r.status === "cancelled",
    );
    if (finished.status !== "completed") {
      throw new Error(finished.error || finished.message || `Run ended as ${finished.status}`);
    }
    setProcessStep(4);
    const result = await getRegistrationResults(finished.id);
    const metrics = result.metrics as {
      raw_match_count?: number;
      inlier_count?: number;
      inlier_ratio?: number;
      rmse_px?: number;
      spatial_coverage?: number;
      rotation_deg?: number;
      scale?: number;
      H?: number[][];
      conclusion?: string;
    };
    setLoftr({
      job_id: finished.id,
      mkpts0: [],
      mkpts1: [],
      mconf: [],
      num_matches: metrics.raw_match_count ?? 0,
      mean_confidence: 0,
      matched_mean_confidence: 0,
      weak_regions: [],
      preview_url: result.download_urls.matches || "",
      unmatched_preview_url: undefined,
      matcher: result.engine_version,
      engine: result.engine.replace(/_/g, "-") as MatcherEngine,
      requested_engine: engine,
      fallback_used: result.fallback_used,
      runtime_ms: result.runtime_ms ?? undefined,
      status: "ok",
    });
    setRansac({
      job_id: finished.id,
      H: metrics.H ?? [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      inlier_ratio: metrics.inlier_ratio ?? 0,
      inlier_count: metrics.inlier_count ?? 0,
      rmse_px: metrics.rmse_px ?? 0,
      spatial_coverage: metrics.spatial_coverage ?? 0,
      rotation_deg: metrics.rotation_deg ?? 0,
      scale: metrics.scale ?? 1,
      translation_px: [0, 0],
      warped_url: result.download_urls.warped || "",
      overlay_url: result.download_urls.overlay || "",
      tint_overlay_url: result.download_urls.tint_overlay || "",
      conclusion: metrics.conclusion || "Platform registration complete (pixel RMSE ≠ geodetic accuracy).",
      reliability: result.reliability as Awaited<ReturnType<typeof runRansac>>["reliability"],
      engine: result.engine,
      matcher: result.engine_version,
      fallback_used: result.fallback_used,
      runtime_ms_match: result.runtime_ms ?? undefined,
      raw_match_count: metrics.raw_match_count,
    });
    recordExperiment(
      {
        job_id: finished.id,
        mkpts0: [],
        mkpts1: [],
        mconf: [],
        num_matches: metrics.raw_match_count ?? 0,
        mean_confidence: 0,
        weak_regions: [],
        preview_url: result.download_urls.matches || "",
        matcher: result.engine_version,
        engine: result.engine,
        fallback_used: result.fallback_used,
        runtime_ms: result.runtime_ms ?? undefined,
      } as Awaited<ReturnType<typeof runLoftr>>,
      {
        job_id: finished.id,
        H: metrics.H ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        inlier_ratio: metrics.inlier_ratio ?? 0,
        inlier_count: metrics.inlier_count ?? 0,
        rmse_px: metrics.rmse_px ?? 0,
        spatial_coverage: metrics.spatial_coverage ?? 0,
        rotation_deg: metrics.rotation_deg ?? 0,
        scale: metrics.scale ?? 1,
        translation_px: [0, 0],
        warped_url: result.download_urls.warped || "",
        overlay_url: result.download_urls.overlay || "",
        tint_overlay_url: result.download_urls.tint_overlay || "",
        conclusion: metrics.conclusion || "",
        reliability: result.reliability as Awaited<ReturnType<typeof runRansac>>["reliability"],
        engine: result.engine,
        fallback_used: result.fallback_used,
        raw_match_count: metrics.raw_match_count,
      } as Awaited<ReturnType<typeof runRansac>>,
      finished.id,
    );
    // Kick async export (non-blocking)
    void createExport(finished.id)
      .then((exp) => pollUntil(() => getExport(exp.id), (e) => e.status === "completed" || e.status === "failed"))
      .catch(() => undefined);
    setStage("done");
  };

  const startDemo = async () => {
    setBusy(true);
    setError(null);
    setProcessStep(0);
    setInputDataStatus("illustrative / sample demo imagery");
    try {
      if (workspaceMode === "platform") {
        // Platform still uses legacy demo images as illustrative uploads when available via fetch
        const demo = await loadDemo();
        const blobs = await Promise.all(demo.preview_urls.map(async (u) => (await fetch(u)).blob()));
        const pair = blobs.slice(0, 2).map((b, i) => new File([b], `demo_${i + 1}.png`, { type: "image/png" }));
        setPreviews(demo.preview_urls);
        setFiles(pair);
        setCount(pair.length);
        await runPlatformRegistration(pair, "illustrative / sample demo imagery");
        return;
      }
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
      setProcessStep(0);
      const result = await runClahe(demo.job_id);
      setClahe(result);
      setProcessStep(1);
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
    setProcessStep(0);
    setInputDataStatus("real uploaded image");
    try {
      if (workspaceMode === "platform") {
        await runPlatformRegistration((files.filter(Boolean) as File[]).slice(0, 2), "real uploaded image");
        return;
      }
      const uploaded = await uploadImages(files.filter(Boolean) as File[], 0);
      setJobId(uploaded.job_id);
      setLastRegistrationJobId(uploaded.job_id);
      setStage("clahe");
      const result = await runClahe(uploaded.job_id);
      setClahe(result);
      setProcessStep(1);
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
    setProcessStep(1);
    try {
      const matchResult = await runLoftr(jobId, Math.min(1, count - 1), engine, true);
      setLoftr(matchResult);
      setProcessStep(2);
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
    setProcessStep(2);
    try {
      const geom = await runRansac(jobId);
      setRansac(geom);
      setProcessStep(4);
      if (loftr) recordExperiment(loftr, geom, jobId);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "RANSAC failed");
    } finally {
      setBusy(false);
    }
  };

  /** Skip step-by-step: load demo and run CLAHE → matching → RANSAC to the end. */
  const skipToFullDemo = async () => {
    setBusy(true);
    setError(null);
    setInputDataStatus("illustrative / sample demo imagery");
    setProcessStep(0);
    try {
      const demo = await loadDemo();
      setApiOnline(true);
      setJobId(demo.job_id);
      setLastRegistrationJobId(demo.job_id);
      setCount(demo.count);
      setPreviews(demo.preview_urls);
      setFiles(
        Array.from({ length: demo.count }, (_, i) => new File([`demo-${i}`], `demo_${i + 1}.png`, { type: "image/png" })),
      );
      setStage("clahe");
      const claheResult = await runClahe(demo.job_id);
      setClahe(claheResult);
      setProcessStep(1);
      setStage("loftr");
      const matchResult = await runLoftr(demo.job_id, Math.min(1, demo.count - 1), engine, true);
      setLoftr(matchResult);
      setProcessStep(2);
      setStage("ransac");
      const ransacResult = await runRansac(demo.job_id);
      setRansac(ransacResult);
      setProcessStep(4);
      recordExperiment(matchResult, ransacResult, demo.job_id);
      setStage("done");
    } catch (e) {
      setApiOnline(false);
      setError(e instanceof Error ? e.message : "Skip demo failed");
      setStage("select");
    } finally {
      setBusy(false);
    }
  };

  const reproduceRun = (run: RunRecord) => {
    setEngine((run.engineRequested || "akaze") as MatcherEngine);
    setHistoryOpen(false);
    setError(null);
    setStage("select");
  };

  return (
    <div className="page space-y-6">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Option A · Core PS flow · mission intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold">Image Registration Wizard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              CLAHE → correspondence matching → RANSAC, with evidence panels and experiment tracking.
            </p>
          </div>
          <button type="button" className="btn btn-secondary !min-h-9 text-xs" onClick={() => setHistoryOpen(true)}>
            Experiment history
          </button>
        </div>
      </GlassCard>

      <PlatformProjectBar serverRun={serverRun} />

      <LineagePanel
        steps={lineageSteps}
        inputDataStatus={inputDataStatus}
        open={lineageOpen}
        onToggle={() => setLineageOpen((v) => !v)}
      />

      <ProcessingStatus active={busy} stepIndex={processStep} />

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
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void skipToFullDemo()}>
              Skip
            </button>
          </div>
          <ModelSelector
            engines={engines}
            value={engine}
            onChange={setEngine}
            loading={enginesLoading}
            fallbackUsed={Boolean(loftr?.fallback_used && loftr.requested_engine === engine)}
          />
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
          <ModelSelector
            engines={engines}
            value={engine}
            onChange={setEngine}
            loading={enginesLoading}
            fallbackUsed={Boolean(loftr?.fallback_used && loftr.requested_engine === engine)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void goLoftr()}>Next · Find matches</button>
        </GlassCard>
      ) : null}

      {stage === "loftr" && busy ? <RocketLoader title="Finding matching points…" tips={LOFTR_TIPS} /> : null}
      {stage === "loftr" && !busy && loftr ? (
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <p className="kicker">Stage 2 · Correspondence matching</p>
            <img src={loftr.preview_url} alt="Matches" className="w-full rounded-2xl border border-[var(--border)]" />
            <p className="text-xs text-[var(--muted)]">
              <span className="mr-3 inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> Green = matched</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Red = unmatched</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric
                label="Total keypoints"
                value={String(loftr.total_keypoints_evaluated ?? (loftr.num_matches + (loftr.num_unmatched ?? 0)))}
                tip="All keypoints detected on both images before the match/unmatch split."
              />
              <Metric
                label="Matched (green)"
                value={String(loftr.num_matches)}
                tip="Raw correspondences from the selected engine (or AKAZE fallback)."
              />
              <Metric
                label="Matched confidence"
                value={`${((loftr.matched_mean_confidence ?? loftr.mean_confidence) * 100).toFixed(1)}%`}
                tip="Mean confidence of matched (green) keypoints only — unmatched/red points are excluded from this average."
              />
              <Metric
                label="Runtime"
                value={loftr.runtime_ms != null ? `${loftr.runtime_ms.toFixed(0)} ms` : "—"}
                tip="Matcher wall time on the server for this pair."
              />
              <Metric
                label="Requested engine"
                value={String(loftr.requested_engine ?? engine)}
                tip="Engine selected in the UI before matching."
              />
              <Metric
                label="Engine used"
                value={String(loftr.engine ?? "akaze")}
                tip={
                  loftr.fallback_used
                    ? `Fallback used. ${loftr.fallback_reason || loftr.matcher}`
                    : loftr.matcher || "AKAZE + Lowe ratio classical baseline"
                }
              />
            </div>
            {loftr.fallback_used ? (
              <p className="rounded-xl border border-[color-mix(in_srgb,var(--warn)_45%,transparent)] px-3 py-2 text-xs text-[var(--warn)]">
                Fallback used — requested AI engine was unavailable; classical AKAZE baseline ran instead.
              </p>
            ) : null}
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
                <figcaption className="mt-2 text-xs text-[var(--muted)]">
                  <span className="mr-2 inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Red = reference
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Blue = warped source
                  </span>
                </figcaption>
              </figure>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Spatial coverage" value={`${(ransac.spatial_coverage * 100).toFixed(0)}%`} tip="Share of reference tiles containing inliers." />
              <Metric label="Inlier ratio" value={`${(ransac.inlier_ratio * 100).toFixed(1)}%`} tip="Matches agreeing with the homography." />
              <Metric label="Inlier count" value={String(ransac.inlier_count)} />
              <Metric label="RMSE (px)" value={ransac.rmse_px.toFixed(2)} tip="Pixel reprojection error on inliers." />
              <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="kicker">Transform H</p>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
                    onClick={() => setShowHInfo((v) => !v)}
                    aria-label="Info about Transform H"
                  >
                    <Info size={14} strokeWidth={2.25} />
                  </button>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse font-mono text-[11px] leading-5 text-[var(--accent)] sm:text-xs">
                    <tbody>
                      {ransac.H.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((v, ci) => (
                            <td key={ci} className="px-1 py-0.5 text-right tabular-nums">
                              {formatHomographyValue(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Metric label="Δ rot / scale" value={`${ransac.rotation_deg.toFixed(1)}° / ${ransac.scale.toFixed(2)}×`} />
            </div>
            {showHInfo ? (
              <div className="rounded-2xl border border-[var(--border)] bg-black/30 p-4 text-sm leading-6">
                <p className="kicker mb-2">What is the transformation matrix?</p>
                <p className="text-[var(--muted)]">
                  This 3×3 homography is the recipe that rotates, scales, shifts and skews the source into the reference frame.
                  Numbers above are the nine matrix entries shown row-by-row.
                </p>
                <pre className="mt-3 overflow-auto text-xs text-[var(--accent)]">{ransac.H.map((row) => row.map((v) => formatHomographyValue(v)).join("  ")).join("\n")}</pre>
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
            <ReliabilityPanel reliability={ransac.reliability ?? null} />
            <div ref={guideRef}>
              <LunaGuidePanel
                rmsePx={ransac.rmse_px}
                reliability={ransac.reliability ?? null}
                rawMatches={ransac.raw_match_count ?? loftr?.num_matches}
                inlierRatio={ransac.inlier_ratio}
                coverage={ransac.spatial_coverage}
                fallbackUsed={Boolean(ransac.fallback_used || loftr?.fallback_used)}
                engine={engine}
                runA={runs.find((r) => r.id === selectedRunIds[0]) ?? null}
                runB={runs.find((r) => r.id === selectedRunIds[1]) ?? null}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-xs text-[var(--muted)]">
              <div className="rounded-xl border border-[var(--border)] p-3">
                Runtime match {loftr?.runtime_ms != null ? `${loftr.runtime_ms.toFixed(0)} ms` : "—"}
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                Raw matches {ransac.raw_match_count ?? loftr?.num_matches ?? "—"}
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                Engine {ransac.engine ?? loftr?.engine ?? engine}
                {ransac.fallback_used || loftr?.fallback_used ? " · fallback" : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!loftr?.preview_url}
                onClick={() => {
                  if (!loftr?.preview_url) return;
                  void downloadImage(loftr.preview_url, "matched_spots.png").catch((e) =>
                    setError(e instanceof Error ? e.message : "Matched download failed"),
                  );
                }}
              >
                Download matched spots
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!loftr?.unmatched_preview_url}
                onClick={() => {
                  if (!loftr?.unmatched_preview_url) return;
                  void downloadImage(loftr.unmatched_preview_url, "unmatched_spots.png").catch((e) =>
                    setError(e instanceof Error ? e.message : "Unmatched download failed"),
                  );
                }}
              >
                Download unmatched spots
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setHistoryOpen(true)}>
                Compare runs
              </button>
            </div>
          </GlassCard>
        </div>
      ) : null}

      <ExperimentDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        runs={runs}
        selectedIds={selectedRunIds}
        onToggleSelect={(id) =>
          setSelectedRunIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= 2) return [prev[1]!, id];
            return [...prev, id];
          })
        }
        onReproduce={reproduceRun}
      />
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

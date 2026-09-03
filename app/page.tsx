"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JudgeWalkthrough, JUDGE_STEPS } from "@/app/components/JudgeWalkthrough";
import { SensorCard } from "@/app/components/SensorCard";
import { DropZoneImageSlot } from "@/app/components/DropZoneImageSlot";
import { GlobalDropZoneBanner } from "@/app/components/GlobalDropZoneBanner";
import { CoveragePanel, MatchCanvas, QualityBadge } from "@/app/components/PipelineWidgets";
import { loadDemoSet } from "@/app/lib/io/loadImages";
import { prepareUploadFile, type ImageMeta } from "@/app/lib/io/prepareUpload";
import { preprocessAll, runAllPairs, runPairPipeline } from "@/app/lib/pipeline/runPipeline";
import { exportAllMetrics, exportPairResults } from "@/app/lib/exports/exportResults";
import type {
  DemoSetDescriptor,
  ImageKey,
  LoadedImage,
  PairId,
  PairPipelineResult,
} from "@/app/lib/types";
import { PAIR_DEFS } from "@/app/lib/types";

const SLOTS: { key: ImageKey; title: string; hint: string }[] = [
  { key: "A", title: "Image A · OHRC-like", hint: "Chandrayaan-2 high-res optical" },
  { key: "B", title: "Image B · LRO/TMC-like", hint: "Reference map product" },
  { key: "C", title: "Image C · IIRS-like", hint: "Mineralogy / derived product" },
];

function highlightClass(active: boolean): string {
  return active ? "ring-2 ring-[#d8ff3e] ring-offset-2 ring-offset-black" : "";
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walkthroughOpen = searchParams.get("walkthrough") === "1";
  const stepParam = Number(searchParams.get("step") || "0");
  const stepIndex = Number.isFinite(stepParam)
    ? Math.min(JUDGE_STEPS.length - 1, Math.max(0, stepParam))
    : 0;

  const [rawImages, setRawImages] = useState<Partial<Record<ImageKey, LoadedImage>>>({});
  const [processed, setProcessed] = useState<Record<ImageKey, LoadedImage> | null>(null);
  const [pairs, setPairs] = useState<Record<PairId, PairPipelineResult> | null>(null);
  const [descriptor, setDescriptor] = useState<DemoSetDescriptor | null>(null);
  const [selectedPair, setSelectedPair] = useState<PairId>("AB");
  const [enableSubPixel, setEnableSubPixel] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [working, setWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<"pipeline" | "baseline" | "gt" | "coverage">("pipeline");
  const [baseline, setBaseline] = useState<{
    classical?: PairPipelineResult;
    loftr?: PairPipelineResult;
  }>({});
  const [sizeWarnings, setSizeWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready for demo or upload.");
  const [stage, setStage] = useState<"input" | "preprocess" | "match" | "results">("input");
  const rawImagesRef = useRef(rawImages);
  rawImagesRef.current = rawImages;

  const currentTarget = walkthroughOpen ? JUDGE_STEPS[stepIndex]?.target : undefined;
  const ready = Boolean(rawImages.A && rawImages.B && rawImages.C);
  const active = pairs?.[selectedPair];

  useEffect(() => {
    if (!walkthroughOpen || !currentTarget) return;
    const el = document.querySelector(`[data-walkthrough="${currentTarget}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [walkthroughOpen, currentTarget, stepIndex]);

  const setWalkthrough = (open: boolean, step = 0) => {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set("walkthrough", "1");
      params.set("step", String(step));
    } else {
      params.delete("walkthrough");
      params.delete("step");
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  };

  const resetPipeline = () => {
    setProcessed(null);
    setPairs(null);
    setBaseline({});
    setStage("input");
  };

  const loadDemo = async (id: "demo_ch2_lro_01" | "synthetic_gt_01") => {
    setLoadingDemo(true);
    setStatus(id === "synthetic_gt_01" ? "Loading synthetic ground-truth pair…" : "Loading curated demo set…");
    try {
      const result = await loadDemoSet(id);
      setDescriptor(result.descriptor);
      setRawImages(result.images);
      setSizeWarnings([]);
      resetPipeline();
      setStatus(`Loaded ${result.descriptor.title}`);
      if (id === "synthetic_gt_01") {
        setSelectedPair("AB");
        setActiveTab("gt");
      }
      if (walkthroughOpen) setWalkthrough(true, Math.max(stepIndex, 1));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Demo load failed");
    } finally {
      setLoadingDemo(false);
    }
  };

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 4000);
  }, []);

  const applyPreparedImage = useCallback((key: ImageKey, imageData: ImageData, meta: ImageMeta) => {
    const loaded: LoadedImage = {
      key,
      fileName: meta.fileName,
      imageData,
      previewUrl: meta.previewUrl,
      convertedFrom: meta.convertedFrom,
      originalWidth: meta.originalWidth,
      originalHeight: meta.originalHeight,
    };
    setRawImages((current) => ({ ...current, [key]: loaded }));
    setSizeWarnings((current) => {
      const withoutSlot = current.filter((item) => !item.startsWith(`${key}:`));
      return meta.warning ? [...withoutSlot, `${key}: ${meta.warning}`] : withoutSlot;
    });
    setDescriptor(null);
    resetPipeline();
    setStatus(`Loaded ${meta.convertedFrom || meta.fileName} as image ${key}`);
  }, []);

  const clearSlot = (key: ImageKey) => {
    setRawImages((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSizeWarnings((current) => current.filter((item) => !item.startsWith(`${key}:`)));
    resetPipeline();
    setStatus(`Cleared image ${key}`);
  };

  const assignDroppedFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || loadingDemo || working) return;
      const extras = files.length > 3;
      if (extras) showToast("Only first 3 images used.");

      if (files.length === 1) {
        const empty = (["A", "B", "C"] as ImageKey[]).find((key) => !rawImagesRef.current[key]);
        if (!empty) {
          showToast("All slots are filled. Drop onto a specific slot to replace it.");
          return;
        }
        setStatus(`Normalizing ${files[0].name}…`);
        try {
          const prepared = await prepareUploadFile(files[0]);
          applyPreparedImage(empty, prepared.imageData, prepared.meta);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Upload failed");
        }
        return;
      }

      const used = files.slice(0, 3);
      const keys: ImageKey[] = ["A", "B", "C"];
      setStatus(`Normalizing ${used.length} dropped images…`);
      try {
        for (let i = 0; i < used.length; i++) {
          const prepared = await prepareUploadFile(used[i]);
          applyPreparedImage(keys[i], prepared.imageData, prepared.meta);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Upload failed");
      }
    },
    [applyPreparedImage, loadingDemo, showToast, working],
  );

  const runPreprocess = async () => {
    if (!ready) return;
    setWorking(true);
    setStatus("Running CLAHE on all three images…");
    try {
      const next = await preprocessAll(rawImages as Record<ImageKey, LoadedImage>);
      setProcessed(next);
      setStage("preprocess");
      setStatus("CLAHE complete.");
    } finally {
      setWorking(false);
    }
  };

  const runMatchingPipeline = async () => {
    if (!processed) return;
    setWorking(true);
    setStatus(enableSubPixel ? "Matching, RANSAC, sub-pixel refinement, warp…" : "Matching, RANSAC, warp…");
    try {
      const H_gtByPair = descriptor?.groundTruth
        ? { [descriptor.groundTruth.pairId]: descriptor.groundTruth.H_gt }
        : undefined;
      const result = await runAllPairs(processed, { enableSubPixel, H_gtByPair });
      setPairs(result);
      setStage("results");
      setStatus("Pipeline complete for A↔B, A↔C, and B↔C.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pipeline failed");
    } finally {
      setWorking(false);
    }
  };

  const runBaseline = async () => {
    if (!processed) return;
    setWorking(true);
    setStatus("Running classical vs LoFTR-style baseline…");
    try {
      const pair = PAIR_DEFS.find((item) => item.id === selectedPair)!;
      const classical = await runPairPipeline(
        processed[pair.left],
        processed[pair.right],
        pair.id,
        { matcher: "classical", classicalMethod: "ORB", enableSubPixel: false },
      );
      const loftr = await runPairPipeline(
        processed[pair.left],
        processed[pair.right],
        pair.id,
        { matcher: "loftr", enableSubPixel: false },
      );
      setBaseline({ classical, loftr });
      setActiveTab("baseline");
      setStatus("Baseline comparison ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Baseline failed");
    } finally {
      setWorking(false);
    }
  };

  const sensorPanel = useMemo(
    () =>
      SLOTS.map((slot) => (
        <SensorCard
          key={slot.key}
          slot={slot.title}
          sensor={rawImages[slot.key]?.sensorInfo}
          emptyLabel={rawImages[slot.key] ? "Upload has no sensor metadata yet." : "Load demo or upload an image."}
        />
      )),
    [rawImages],
  );

  return (
    <div className="space-y-6">
      <section className="border border-[#292927] bg-[#0d0d0d] p-6">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Mission</div>
        <h1 className="mt-2 max-w-3xl text-4xl font-medium tracking-tight text-white">
          Align multi-modal lunar images for Chandrayaan-2 × LRO analysis
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#9a9a96]">
          Upload three products or load a demo, then run CLAHE → matching → RANSAC → optional sub-pixel refinement → warp → metrics/export.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            data-walkthrough="demo-load"
            onClick={() => loadDemo("demo_ch2_lro_01")}
            disabled={loadingDemo || working}
            className={`bg-[#d8ff3e] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-black mono disabled:opacity-40 ${highlightClass(currentTarget === "demo-load")}`}
          >
            {loadingDemo ? "Loading…" : "Load demo set"}
          </button>
          <button
            type="button"
            onClick={() => loadDemo("synthetic_gt_01")}
            disabled={loadingDemo || working}
            className="border border-[#424240] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono disabled:opacity-40"
          >
            Synthetic ground-truth pair
          </button>
          <button
            type="button"
            onClick={() => setWalkthrough(true, 0)}
            className="border border-[#424240] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono"
          >
            Start judge walkthrough
          </button>
          <label className="flex items-center gap-2 border border-[#292927] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[#aaa] mono">
            <input
              type="checkbox"
              checked={enableSubPixel}
              onChange={(e) => setEnableSubPixel(e.target.checked)}
            />
            Enable sub-pixel refinement
          </label>
        </div>
        <p className="mt-3 text-sm text-[#8a8a86]">{status}</p>
      </section>

      <GlobalDropZoneBanner disabled={loadingDemo || working} onFilesDropped={assignDroppedFiles} />

      {toast ? (
        <div
          role="status"
          className="border border-[#5a5418] bg-[rgba(40,36,8,0.9)] px-4 py-3 text-sm text-[#d8c23e]"
        >
          {toast}
        </div>
      ) : null}

      {sizeWarnings.length > 0 ? (
        <section className="border border-[#642828] bg-[rgba(43,5,5,0.85)] p-4 text-sm text-[#ff8c8c]">
          {sizeWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </section>
      ) : null}

      <section data-walkthrough="sensor-panel" className={`space-y-3 ${highlightClass(currentTarget === "sensor-panel")}`}>
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#888]">Sensor info</div>
        <div className="grid gap-4 md:grid-cols-3">{sensorPanel}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const image = rawImages[slot.key] ?? null;
          return (
            <DropZoneImageSlot
              key={slot.key}
              label={slot.title}
              hint={slot.hint}
              image={image}
              sensorInfo={image?.sensorInfo}
              disabled={loadingDemo || working}
              onImageLoaded={(_file, imageData, meta) => applyPreparedImage(slot.key, imageData, meta)}
              onClear={() => clearSlot(slot.key)}
            />
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article data-walkthrough="stage-preprocess" className={`border border-[#292927] bg-[#0d0d0d] p-4 ${highlightClass(currentTarget === "stage-preprocess")}`}>
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#d8ff3e]">1 · Preprocess</div>
          <p className="mt-3 text-sm leading-6 text-[#9a9a96]">
            CLAHE boosts local contrast in shadowed lunar terrain before correspondence finding.
          </p>
          <button
            type="button"
            disabled={!ready || working}
            onClick={runPreprocess}
            className="mt-4 bg-[#d8ff3e] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-black disabled:opacity-30 mono"
          >
            {working && stage === "input" ? "Processing…" : processed ? "Re-run CLAHE" : "Run CLAHE × 3"}
          </button>
          {processed ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {SLOTS.map((slot) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={slot.key} src={processed[slot.key].previewUrl} alt={`CLAHE ${slot.key}`} className="h-20 w-full object-cover grayscale" />
              ))}
            </div>
          ) : null}
        </article>

        <article data-walkthrough="stage-match" className={`border border-[#292927] bg-[#0d0d0d] p-4 ${highlightClass(currentTarget === "stage-match" || currentTarget === "stage-ransac")}`}>
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#d8ff3e]">2 · Match + RANSAC + Warp</div>
          <p className="mt-3 text-sm leading-6 text-[#9a9a96]">
            LoFTR-style matching, RANSAC homography, optional sub-pixel refinement, then warp/overlay for every pair.
          </p>
          <button
            type="button"
            disabled={!processed || working}
            onClick={runMatchingPipeline}
            className="mt-4 bg-[#d8ff3e] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-black disabled:opacity-30 mono"
          >
            {working && processed && !pairs ? "Running pipeline…" : pairs ? "Re-run pairs" : "Run full pair pipeline"}
          </button>
        </article>
      </section>

      {pairs && active ? (
        <section data-walkthrough="stage-results" className={`space-y-4 ${highlightClass(currentTarget === "stage-results" || currentTarget === "metrics-panel" || currentTarget === "exports-panel")}`}>
          {active.metrics.quality === "Unreliable" ? (
            <div className="border border-[#642828] bg-[rgba(43,5,5,0.9)] p-4 text-sm text-[#ff8c8c]">
              Registration quality: Unreliable – results may be incorrect. Try another pair, adjust inputs, or treat exports as experimental.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {PAIR_DEFS.map((pair) => (
              <button
                key={pair.id}
                type="button"
                onClick={() => setSelectedPair(pair.id)}
                className={`border px-3 py-2 text-[10px] uppercase tracking-[0.1em] mono ${
                  selectedPair === pair.id
                    ? "border-[#d8ff3e] bg-[#151515] text-white"
                    : "border-[#292927] text-[#777]"
                }`}
              >
                {pair.label} · {pairs[pair.id].ransac.inliers.length} inliers
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border border-[#292927] bg-[#0d0d0d] p-2">
            {[
              { id: "pipeline" as const, label: "Results", target: "metrics-panel" },
              { id: "coverage" as const, label: "Coverage", target: "metrics-panel" },
              { id: "baseline" as const, label: "Baseline comparison", target: "baseline-tab" },
              { id: "gt" as const, label: "Ground-truth validation", target: "gt-panel" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-walkthrough={tab.target}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "baseline" && !baseline.classical) runBaseline();
                }}
                className={`px-3 py-2 text-[10px] uppercase tracking-[0.1em] mono ${
                  activeTab === tab.id ? "bg-[#151515] text-white shadow-[inset_0_-1px_0_#d8ff3e]" : "text-[#777]"
                } ${highlightClass(currentTarget === tab.target)}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "pipeline" ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">RMSE</div>
                  <div className="mt-2 text-2xl text-[#d8ff3e]">{active.metrics.rmse.toFixed(2)} px</div>
                  {active.metrics.refinedRmse != null ? (
                    <div className="mt-1 text-xs text-[#8a8a86]">
                      Refined RMSE: {active.metrics.refinedRmse.toFixed(2)} px
                    </div>
                  ) : null}
                </div>
                <div className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Inlier ratio</div>
                  <div className="mt-2 text-2xl text-white">{(active.metrics.inlierRatio * 100).toFixed(1)}%</div>
                  <div className="mt-1 text-xs text-[#8a8a86]">
                    {active.metrics.inlierCount}/{active.metrics.totalMatches}
                  </div>
                </div>
                <div className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Coverage</div>
                  <div className="mt-2 text-2xl text-white">{(active.metrics.coverage * 100).toFixed(0)}%</div>
                  <div className="mt-1 text-xs text-[#8a8a86]">
                    Uniform: {active.metrics.uniformRegistration ? "Yes" : "No"}
                  </div>
                </div>
                <div className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Quality</div>
                  <div className="mt-3"><QualityBadge quality={active.metrics.quality} /></div>
                </div>
              </div>

              <MatchCanvas
                leftUrl={processed![active.left].previewUrl}
                rightUrl={processed![active.right].previewUrl}
                matches={active.matches}
                inliers={active.ransac.inliers}
                refined={active.refinedMatches}
                leftLabel={active.left}
                rightLabel={active.right}
                leftSize={{ width: processed![active.left].imageData.width, height: processed![active.left].imageData.height }}
                rightSize={{ width: processed![active.right].imageData.width, height: processed![active.right].imageData.height }}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Registered / overlay</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.warpedPreviewUrl} alt="Warped" className="h-40 w-full object-contain grayscale" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.overlayPreviewUrl} alt="Overlay" className="h-40 w-full object-contain grayscale" />
                  </div>
                </div>
                <div data-walkthrough="exports-panel" className="border border-[#292927] bg-[#101010] p-4">
                  <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Homography + exports</div>
                  <div className="mt-3 grid grid-cols-3 gap-1 mono text-[10px] text-[#bbb]">
                    {active.ransac.H?.flat().map((v, i) => (
                      <code key={i} className="border border-[#292927] px-2 py-1 text-right">{v.toFixed(5)}</code>
                    ))}
                  </div>
                  {active.metrics.subPixel ? (
                    <div className="mt-4 space-y-1 text-sm text-[#9a9a96]">
                      <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#d8ff3e]">Sub-pixel refinement</div>
                      <div>Refined points: {active.metrics.subPixel.refinedCount}/{active.metrics.subPixel.attempted}</div>
                      <div>Median shift: {active.metrics.subPixel.medianShift.toFixed(3)} px</div>
                      <div>
                        RMSE before → after: {active.metrics.subPixel.rmseBefore.toFixed(3)} → {active.metrics.subPixel.rmseAfter.toFixed(3)}
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => exportPairResults(active, processed![active.right].previewUrl)}
                    className="mt-4 border border-[#424240] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono"
                  >
                    Export pair package {active.metrics.quality === "Unreliable" ? "(experimental)" : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportAllMetrics(Object.values(pairs))}
                    className="mt-2 ml-2 border border-[#424240] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono"
                  >
                    Export all metrics.json
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "coverage" ? <CoveragePanel pair={active} /> : null}

          {activeTab === "baseline" ? (
            <div data-walkthrough="baseline-tab" className="space-y-4">
              <p className="text-sm leading-6 text-[#9a9a96]">
                Classical methods (SIFT/ORB) rely on local appearance and can struggle with large illumination or scale changes.
                Our LoFTR-style matcher uses broader context and is more robust to such changes.
              </p>
              {working && !baseline.classical ? <div className="text-sm text-[#d8c23e]">Running baseline…</div> : null}
              {baseline.classical && baseline.loftr ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Classical ORB-like", result: baseline.classical, color: "text-[#ff8c8c]" },
                    { label: "LoFTR-style adapter", result: baseline.loftr, color: "text-[#d8ff3e]" },
                  ].map((item) => (
                    <div key={item.label} className="border border-[#292927] bg-[#101010] p-4">
                      <div className={`mono text-[10px] uppercase tracking-[0.12em] ${item.color}`}>{item.label}</div>
                      <div className="mt-3 space-y-1 text-sm text-[#9a9a96]">
                        <div>Matches: {item.result.metrics.totalMatches}</div>
                        <div>Inliers: {item.result.metrics.inlierCount}</div>
                        <div>Inlier ratio: {(item.result.metrics.inlierRatio * 100).toFixed(1)}%</div>
                        <div>RMSE: {item.result.metrics.rmse.toFixed(2)} px</div>
                        <div className="pt-2"><QualityBadge quality={item.result.metrics.quality} /></div>
                      </div>
                      <div className="mt-3">
                        <MatchCanvas
                          leftUrl={processed![item.result.left].previewUrl}
                          rightUrl={processed![item.result.right].previewUrl}
                          matches={item.result.matches}
                          inliers={item.result.ransac.inliers}
                          leftLabel={item.result.left}
                          rightLabel={item.result.right}
                          leftSize={{ width: processed![item.result.left].imageData.width, height: processed![item.result.left].imageData.height }}
                          rightSize={{ width: processed![item.result.right].imageData.width, height: processed![item.result.right].imageData.height }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!processed || working}
                  onClick={runBaseline}
                  className="border border-[#424240] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono"
                >
                  Run baseline comparison
                </button>
              )}
            </div>
          ) : null}

          {activeTab === "gt" ? (
            <div data-walkthrough="gt-panel" className="space-y-4 border border-[#292927] bg-[#0d0d0d] p-4">
              {active.metrics.groundTruth ? (
                <>
                  <p className="text-sm leading-6 text-[#9a9a96]">{active.metrics.groundTruth.note}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">H_gt</div>
                      <div className="mt-2 grid grid-cols-3 gap-1 mono text-[10px] text-[#bbb]">
                        {active.metrics.groundTruth.H_gt.flat().map((v, i) => (
                          <code key={i} className="border border-[#292927] px-2 py-1 text-right">{v.toFixed(5)}</code>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">H_est</div>
                      <div className="mt-2 grid grid-cols-3 gap-1 mono text-[10px] text-[#bbb]">
                        {active.metrics.groundTruth.H_est.flat().map((v, i) => (
                          <code key={i} className="border border-[#292927] px-2 py-1 text-right">{v.toFixed(5)}</code>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="border border-[#292927] p-3">
                      <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Max corner error</div>
                      <div className="mt-2 text-xl text-white">{active.metrics.groundTruth.maxCornerError.toFixed(3)} px</div>
                    </div>
                    <div className="border border-[#292927] p-3">
                      <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Mean corner error</div>
                      <div className="mt-2 text-xl text-white">{active.metrics.groundTruth.meanCornerError.toFixed(3)} px</div>
                    </div>
                    <div className="border border-[#292927] p-3">
                      <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Mean |H| diff</div>
                      <div className="mt-2 text-xl text-white">{active.metrics.groundTruth.meanAbsDiff.toFixed(4)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#9a9a96]">
                  Load the <strong className="text-white">Synthetic ground-truth pair</strong> demo, run the pipeline, then reopen this tab to compare H_est against known H_gt.
                </p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <JudgeWalkthrough
        open={walkthroughOpen}
        stepIndex={stepIndex}
        onClose={() => setWalkthrough(false)}
        onPrev={() => setWalkthrough(true, Math.max(0, stepIndex - 1))}
        onNext={() => {
          if (stepIndex >= JUDGE_STEPS.length - 1) setWalkthrough(false);
          else setWalkthrough(true, stepIndex + 1);
        }}
        onJump={(index) => setWalkthrough(true, index)}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#888]">Loading register workspace…</div>}>
      <HomePageInner />
    </Suspense>
  );
}

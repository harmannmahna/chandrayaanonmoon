"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JudgeWalkthrough, JUDGE_STEPS } from "@/app/components/JudgeWalkthrough";
import { SensorCard } from "@/app/components/SensorCard";
import { loadDemoSet, loadUserImage } from "@/app/lib/io/loadImages";
import { assessImageSize, maybeDownsampleForPreview } from "@/app/lib/io/imageSizeGuards";
import type { ImageKey, LoadedImage } from "@/app/lib/types";

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
  const stepIndex = Number.isFinite(stepParam) ? Math.min(JUDGE_STEPS.length - 1, Math.max(0, stepParam)) : 0;

  const [images, setImages] = useState<Partial<Record<ImageKey, LoadedImage>>>({});
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [activeTab, setActiveTab] = useState<"pipeline" | "baseline" | "gt">("pipeline");
  const [sizeWarnings, setSizeWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready for demo or upload.");

  const currentTarget = walkthroughOpen ? JUDGE_STEPS[stepIndex]?.target : undefined;

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

  const loadDemo = async () => {
    setLoadingDemo(true);
    setStatus("Loading curated demo set…");
    try {
      const result = await loadDemoSet("demo_ch2_lro_01");
      setImages(result.images);
      setSizeWarnings([]);
      setStatus(`Loaded ${result.descriptor.title}`);
      if (walkthroughOpen) setWalkthrough(true, Math.max(stepIndex, 1));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Demo load failed");
    } finally {
      setLoadingDemo(false);
    }
  };

  const onUpload = async (key: ImageKey, file: File | null) => {
    if (!file) {
      setImages((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setStatus(`Normalizing ${file.name}…`);
    try {
      let loaded = await loadUserImage(key, file);
      const warning = assessImageSize(loaded.imageData.width, loaded.imageData.height);
      const notes: string[] = [];
      if (warning.message) notes.push(`${key}: ${warning.message}`);
      if (warning.suggestDownsample) {
        const preview = maybeDownsampleForPreview(loaded.imageData);
        if (preview.downsampled) {
          loaded = {
            ...loaded,
            imageData: preview.imageData,
            previewUrl: imageDataToUrl(preview.imageData),
          };
          notes.push(`${key}: preview downsampled for interactive use.`);
        }
      }
      setSizeWarnings((current) => [...current.filter((item) => !item.startsWith(`${key}:`)), ...notes]);
      setImages((current) => ({ ...current, [key]: loaded }));
      setStatus(`Loaded ${file.name} as image ${key}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const ready = Boolean(images.A && images.B && images.C);

  const sensorPanel = useMemo(
    () =>
      SLOTS.map((slot) => (
        <SensorCard
          key={slot.key}
          slot={slot.title}
          sensor={images[slot.key]?.sensorInfo}
          emptyLabel={images[slot.key] ? "Upload has no sensor metadata yet." : "Load demo or upload an image."}
        />
      )),
    [images],
  );

  return (
    <div className="space-y-6">
      <section className="border border-[#292927] bg-[#0d0d0d] p-6">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Mission</div>
        <h1 className="mt-2 max-w-3xl text-4xl font-medium tracking-tight text-white">
          Align multi-modal lunar images for Chandrayaan-2 × LRO analysis
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#9a9a96]">
          Upload three products or load the curated demo. Then walk preprocess → match → RANSAC → warp → metrics → export.
          Use <strong className="text-[#d5d5d2]">How to demo</strong> for a judge-paced walkthrough.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            data-walkthrough="demo-load"
            onClick={loadDemo}
            disabled={loadingDemo}
            className={`bg-[#d8ff3e] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-black mono disabled:opacity-40 ${highlightClass(currentTarget === "demo-load")}`}
          >
            {loadingDemo ? "Loading demo…" : "Load demo set"}
          </button>
          <button
            type="button"
            onClick={() => setWalkthrough(true, 0)}
            className="border border-[#424240] px-4 py-3 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] mono"
          >
            Start judge walkthrough
          </button>
        </div>
        <p className="mt-3 text-sm text-[#8a8a86]">{status}</p>
      </section>

      {sizeWarnings.length > 0 ? (
        <section className="border border-[#642828] bg-[rgba(43,5,5,0.85)] p-4 text-sm text-[#ff8c8c]">
          {sizeWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </section>
      ) : null}

      <section
        data-walkthrough="sensor-panel"
        className={`space-y-3 ${highlightClass(currentTarget === "sensor-panel")}`}
      >
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#888]">Sensor info</div>
        <div className="grid gap-4 md:grid-cols-3">{sensorPanel}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const image = images[slot.key];
          return (
            <label key={slot.key} className="cursor-pointer border border-[#292927] bg-[#101010] p-4">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#666]">{slot.title}</div>
              <div className="mt-2 text-sm text-[#9a9a96]">{slot.hint}</div>
              <div className="mt-4 flex h-40 items-center justify-center overflow-hidden border border-[#292927] bg-[#050505]">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.previewUrl} alt={slot.title} className="h-full w-full object-cover grayscale" />
                ) : (
                  <span className="text-xs text-[#666]">Drop / select image or XML</span>
                )}
              </div>
              <input
                className="mt-3 block w-full text-xs text-[#888]"
                type="file"
                accept="image/*,.xml,.svg"
                onChange={(event) => onUpload(slot.key, event.target.files?.[0] || null)}
              />
            </label>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { id: "stage-preprocess", title: "1 · Preprocess", text: "CLAHE equalizes local contrast before matching." },
          { id: "stage-match", title: "2 · Match", text: "LoFTR-style adapter finds cross-sensor correspondences." },
          { id: "stage-ransac", title: "3 · RANSAC", text: "Estimate H and keep geometrically consistent inliers." },
          { id: "stage-results", title: "4 · Warp / overlay", text: "Produce registered image and visual proof blend." },
        ].map((card) => (
          <article
            key={card.id}
            data-walkthrough={card.id}
            className={`border border-[#292927] bg-[#0d0d0d] p-4 ${highlightClass(currentTarget === card.id)}`}
          >
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#d8ff3e]">{card.title}</div>
            <p className="mt-3 text-sm leading-6 text-[#9a9a96]">{card.text}</p>
            <button
              type="button"
              disabled={!ready}
              className="mt-4 border border-[#424240] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[#d5d5d2] disabled:opacity-30 mono"
              onClick={() => setStatus(`${card.title} staged for current image set.`)}
            >
              Mark stage ready
            </button>
          </article>
        ))}
      </section>

      <section className="border border-[#292927] bg-[#0d0d0d]">
        <div className="flex flex-wrap gap-2 border-b border-[#292927] p-2">
          {[
            { id: "pipeline" as const, label: "Pipeline", target: "metrics-panel" },
            { id: "baseline" as const, label: "Baseline comparison", target: "baseline-tab" },
            { id: "gt" as const, label: "Ground-truth validation", target: "gt-panel" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-walkthrough={tab.target}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[10px] uppercase tracking-[0.1em] mono ${
                activeTab === tab.id ? "bg-[#151515] text-white shadow-[inset_0_-1px_0_#d8ff3e]" : "text-[#777]"
              } ${highlightClass(currentTarget === tab.target)}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "pipeline" ? (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div data-walkthrough="metrics-panel" className={`border border-[#292927] bg-[#101010] p-4 ${highlightClass(currentTarget === "metrics-panel")}`}>
              <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Metrics</div>
              <p className="mt-3 text-sm leading-6 text-[#9a9a96]">
                RMSE, inlier ratio, coverage, and quality badges live here after RANSAC. Quality can drop to Unreliable when evidence is weak.
              </p>
            </div>
            <div data-walkthrough="exports-panel" className={`border border-[#292927] bg-[#101010] p-4 ${highlightClass(currentTarget === "exports-panel")}`}>
              <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Exports</div>
              <p className="mt-3 text-sm leading-6 text-[#9a9a96]">
                registered_source.png · overlay_proof.png · match_points.csv · homography.json · metrics.json
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === "baseline" ? (
          <div className="space-y-3 p-4">
            <p className="text-sm leading-6 text-[#9a9a96]">
              Classical methods (SIFT/ORB) rely on local appearance and can struggle with large illumination or scale changes.
              Our LoFTR-style matcher uses broader context and is more robust to such changes.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-[#292927] bg-[#101010] p-4">
                <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#888]">Classical</div>
                <p className="mt-2 text-sm text-[#9a9a96]">ORB/SIFT-like baseline plugged into the same RANSAC + metrics path.</p>
              </div>
              <div className="border border-[#292927] bg-[#101010] p-4">
                <div className="mono text-[10px] uppercase tracking-[0.12em] text-[#d8ff3e]">LoFTR-style</div>
                <p className="mt-2 text-sm text-[#9a9a96]">Adapter stage intended for dense cross-image matching under lighting shift.</p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "gt" ? (
          <div data-walkthrough="gt-panel" className={`space-y-3 p-4 ${highlightClass(currentTarget === "gt-panel")}`}>
            <p className="text-sm leading-6 text-[#9a9a96]">
              Synthetic ground-truth validation compares estimated H against a known H_gt using corner reprojection error.
              This demonstrates internal consistency on a controlled pair. Real lunar data lacks exact ground truth.
            </p>
          </div>
        ) : null}
      </section>

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

function imageDataToUrl(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d")!.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#888]">Loading register workspace…</div>}>
      <HomePageInner />
    </Suspense>
  );
}

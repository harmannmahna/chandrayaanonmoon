import { useMemo, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "../components/GlassCard";
import { RocketLoader } from "../components/RocketLoader";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { LunarMissionMap } from "../components/ice/LunarMissionMap";
import { loadDemo, runClahe, uploadImages, type ClaheResponse } from "../api/client";
import { useAppStore } from "../store/appStore";
import { buildDemoCraterDataset } from "../lib/ice/demoData";
import { runIceAnalysis } from "../lib/ice/iceAnalysis";
import { createLandingSuitabilityGrid, rankLandingCandidates } from "../lib/ice/landingAnalysis";
import { planAStarRoute } from "../lib/ice/pathPlanning";
import { computeIceVolumeScenario, getDefaultScenarios } from "../lib/ice/volumeEstimator";
import { downloadMissionPackage, gridToPngBlob } from "../lib/ice/exports";
import { IceLunaGuide } from "../components/mission/IceLunaGuide";
import { IcePlatformPersist } from "../components/mission/IcePlatformPersist";
import {
  DEFAULT_ICE_PARAMS,
  DEFAULT_LANDING_PARAMS,
  DEFAULT_ROUTE_PARAMS,
  DEFAULT_VOLUME_PARAMS,
  type BooleanGrid,
  type CraterDataset,
  type Grid,
  type IceAnalysisParams,
  type IceCandidateCluster,
  type IceEvidenceSummary,
  type LandingCandidate,
  type LandingParams,
  type LayerKey,
  type RoverRoute,
  type RouteParams,
  type VolumeParams,
  type VolumeScenario,
} from "../lib/ice/types";

type Stage = "select" | "enhance" | "mission";

const STAGE1_TIPS = [
  "Upload optical frames of your lunar patch, or load the demo pair — same bridge as Register.",
  "Stage 3 radar layers use an illustrative doubly-shadowed crater grid (not calibrated DFSAR).",
];
const STAGE2_TIPS = [
  "CLAHE boosts local contrast so crater rims and shadowed bowls are easier to read before mission planning.",
];

const ALL_LAYERS: LayerKey[] = [
  "cpr",
  "dop",
  "psr",
  "slope",
  "roughness",
  "hazard",
  "illumination",
  "iceCandidates",
  "iceConfidence",
  "landingSuitability",
  "roverRoute",
];

function isImageFile(f: File | null | undefined): f is File {
  if (!f) return false;
  if (f.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|tif{1,2})$/i.test(f.name);
}

export function IceDetectionPage() {
  const setLastRegistrationJobId = useAppStore((s) => s.setLastRegistrationJobId);
  const [stage, setStage] = useState<Stage>("select");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [count, setCount] = useState(2);
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null]);
  const [clahe, setClahe] = useState<ClaheResponse | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragDepth = useRef<Record<number, number>>({});

  // Stage 3 mission state
  const [dataset, setDataset] = useState<CraterDataset | null>(null);
  const [layers, setLayers] = useState<Set<LayerKey>>(
    () => new Set<LayerKey>(["cpr", "dop", "psr", "iceCandidates", "roverRoute"]),
  );
  const [iceParams, setIceParams] = useState<IceAnalysisParams>(DEFAULT_ICE_PARAMS);
  const [landingParams, setLandingParams] = useState<LandingParams>(DEFAULT_LANDING_PARAMS);
  const [routeParams, setRouteParams] = useState<RouteParams>(DEFAULT_ROUTE_PARAMS);
  const [volumeParams, setVolumeParams] = useState<VolumeParams>(DEFAULT_VOLUME_PARAMS);
  const [iceMask, setIceMask] = useState<BooleanGrid | null>(null);
  const [iceConfidence, setIceConfidence] = useState<Grid | null>(null);
  const [clusters, setClusters] = useState<IceCandidateCluster[]>([]);
  const [summary, setSummary] = useState<IceEvidenceSummary | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [landingGrid, setLandingGrid] = useState<Grid | null>(null);
  const [landings, setLandings] = useState<LandingCandidate[]>([]);
  const [selectedLandingId, setSelectedLandingId] = useState<string | null>(null);
  const [route, setRoute] = useState<RoverRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ x: number; y: number } | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const mapRef = useRef<HTMLCanvasElement>(null);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? null;
  const selectedLanding = landings.find((l) => l.id === selectedLandingId) ?? null;
  const volumes: VolumeScenario[] = useMemo(() => {
    const area = selectedCluster?.areaM2 ?? summary?.bestCluster?.areaM2 ?? 0;
    if (!area) return [];
    try {
      return [
        ...getDefaultScenarios(area, volumeParams.densityKgPerM3),
        computeIceVolumeScenario(area, volumeParams, "Custom"),
      ];
    } catch {
      return getDefaultScenarios(area, volumeParams.densityKgPerM3);
    }
  }, [selectedCluster, summary, volumeParams]);

  const ready = useMemo(() => files.every(Boolean), [files]);

  const setSlotCount = (n: number) => {
    setCount(n);
    setFiles(Array.from({ length: n }, (_, i) => files[i] ?? null));
    setPreviews(Array.from({ length: n }, (_, i) => previews[i] ?? null));
  };

  const setSlot = (i: number, file: File | null) => {
    if (file && !isImageFile(file)) {
      setError("Please drop an image file (PNG, JPG, WEBP, …).");
      return;
    }
    setError(null);
    setFiles((prev) => {
      const next = [...prev];
      next[i] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (prev[i]) URL.revokeObjectURL(prev[i]!);
      next[i] = file ? URL.createObjectURL(file) : null;
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
    setSlot(index, image);
  };

  const startDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const demo = await loadDemo();
      setLastRegistrationJobId(demo.job_id);
      setJobId(demo.job_id);
      setCount(demo.count);
      setPreviews(demo.preview_urls);
      setFiles(Array.from({ length: demo.count }, (_, i) => new File([`demo-${i}`], `demo_${i + 1}.png`, { type: "image/png" })));
      setStage("enhance");
      const c = await runClahe(demo.job_id);
      setClahe(c);
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
      const up = await uploadImages(files.filter(Boolean) as File[], 0);
      setLastRegistrationJobId(up.job_id);
      setJobId(up.job_id);
      setStage("enhance");
      const c = await runClahe(up.job_id);
      setClahe(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStage("select");
    } finally {
      setBusy(false);
    }
  };

  const enterMission = () => {
    const moonPhoto =
      clahe?.images?.[0] ||
      previews.find((p): p is string => Boolean(p)) ||
      "/moon-albedo.jpg";
    const ds = buildDemoCraterDataset();
    ds.baseTexture = moonPhoto;
    setDataset(ds);
    setLayers(new Set<LayerKey>(["psr", "iceCandidates", "roverRoute"]));
    setIceMask(null);
    setIceConfidence(null);
    setClusters([]);
    setSummary(null);
    setSelectedClusterId(null);
    setLandingGrid(null);
    setLandings([]);
    setSelectedLandingId(null);
    setRoute(null);
    setRouteError(null);
    setStage("mission");
  };

  const toggleLayer = (k: LayerKey) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const runAnalysis = () => {
    if (!dataset) return;
    const result = runIceAnalysis(dataset, iceParams);
    setIceMask(result.candidateMask);
    setIceConfidence(result.confidence);
    setClusters(result.clusters);
    setSummary(result.summary);
    setSelectedClusterId(result.clusters[0]?.id ?? null);
    setLandings([]);
    setLandingGrid(null);
    setSelectedLandingId(null);
    setRoute(null);
    setLayers((prev) => new Set([...prev, "iceCandidates", "iceConfidence", "psr"]));
  };

  const findLandings = () => {
    if (!dataset || !selectedCluster) {
      setError("No landing site can be ranked until an ice target cluster is selected.");
      return;
    }
    setError(null);
    const grid = createLandingSuitabilityGrid(dataset, selectedCluster, landingParams);
    const ranked = rankLandingCandidates(grid, dataset, selectedCluster, landingParams);
    setLandingGrid(grid);
    setLandings(ranked);
    setSelectedLandingId(ranked[0]?.id ?? null);
    setRoute(null);
    setLayers((prev) => new Set([...prev, "landingSuitability"]));
  };

  const planRoute = () => {
    if (!dataset || !selectedLanding || !selectedCluster) {
      setRouteError("Select a prototype landing candidate and ice target cluster first.");
      return;
    }
    const goal = {
      x: Math.round(selectedCluster.centroid.x),
      y: Math.round(selectedCluster.centroid.y),
    };
    const planned = planAStarRoute(dataset, { x: selectedLanding.x, y: selectedLanding.y }, goal, routeParams);
    if (!planned) {
      setRoute(null);
      setRouteError(
        "No feasible route under current slope, hazard, and energy constraints. Try battery-supported mode, another landing site, or a less restrictive slope threshold.",
      );
      return;
    }
    setRouteError(null);
    setRoute(planned);
    setLayers((prev) => new Set([...prev, "roverRoute"]));
  };

  const exportPackage = async () => {
    if (!dataset) return;
    const w = dataset.width;
    const h = dataset.height;
    const paintHeat = (grid: Grid | BooleanGrid | null, kind: "mask" | "conf" | "land") =>
      gridToPngBlob(w, h, (ctx) => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        if (!grid) return;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (kind === "mask") {
              if ((grid as BooleanGrid).values[i]) {
                ctx.fillStyle = "#58e0d0";
                ctx.fillRect(x, y, 1, 1);
              }
            } else {
              const v = (grid as Grid).values[i]!;
              const t = kind === "land" ? v / 100 : v;
              ctx.fillStyle = `rgba(80,200,255,${Math.max(0.05, t)})`;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });

    let mapPng: Blob | null = null;
    if (mapRef.current) {
      mapPng = await new Promise((resolve) => mapRef.current!.toBlob((b) => resolve(b), "image/png"));
    }
    await downloadMissionPackage({
      dataset,
      iceParams,
      landingParams,
      routeParams,
      clusters,
      summary,
      selectedCluster,
      landings,
      selectedLanding,
      route,
      volumes,
      mapPng,
      candidatePng: await paintHeat(iceMask, "mask"),
      confidencePng: await paintHeat(iceConfidence, "conf"),
      landingPng: await paintHeat(landingGrid, "land"),
    });
  };

  const inspectInfo = useMemo(() => {
    if (!dataset || !inspect) return null;
    const i = inspect.y * dataset.width + inspect.x;
    return {
      cpr: dataset.cpr.values[i]!,
      dop: dataset.dop.values[i]!,
      psr: dataset.doublyShadowedMask.values[i] === 1,
      slope: dataset.slopeDegrees.values[i]!,
      roughness: dataset.roughness.values[i]!,
      hazard: dataset.hazard.values[i]!,
      illum: dataset.illumination.values[i]!,
      conf: iceConfidence?.values[i] ?? null,
      land: landingGrid?.values[i] ?? null,
      onRoute: route?.cells.some((c) => c.x === inspect.x && c.y === inspect.y) ?? false,
    };
  }, [dataset, inspect, iceConfidence, landingGrid, route]);

  return (
    <div className="page space-y-6">
      <GlassCard className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">LUNA/ICE · Prototype polar mission planner</p>
            <h1 className="mt-2 text-3xl font-semibold">Screen candidates. Plan the path.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Bring optical context in, then explore an illustrative crater planner for radar-threshold screening, landing
              suitability, rover routes, and scenario-based volume — planning support for demos, not mission certification.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
              Browser prototype · Illustrative/supplied layers · Planning support only
            </span>
            <Link to="/briefing" className="btn btn-secondary !min-h-9 !px-3 text-xs">
              Context
            </Link>
            <button type="button" className="btn btn-secondary !min-h-9 !px-3 text-xs" onClick={() => setShowWalkthrough((v) => !v)}>
              How to demo
            </button>
            <Link to="/register" className="btn btn-secondary !min-h-9 !px-3 text-xs">
              Register
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
          <span className={stage === "select" ? "text-[var(--accent)]" : ""}>1 · Upload</span>
          <span>→</span>
          <span className={stage === "enhance" ? "text-[var(--accent)]" : ""}>2 · Enhance</span>
          <span>→</span>
          <span className={stage === "mission" ? "text-[var(--accent)]" : ""}>3 · Mission planner</span>
        </div>
      </GlassCard>

      {showWalkthrough ? (
        <GlassCard className="space-y-2 text-sm leading-6 text-[var(--muted)]">
          <p className="kicker">Judge walkthrough</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Stage 1: upload images or load demo optical pair.</li>
            <li>Stage 2: review CLAHE enhance, then open the mission planner.</li>
            <li>Load the illustrative crater dataset — toggle CPR, DOP, doubly-shadowed mask.</li>
            <li>Set CPR &gt; 1.0 and DOP &lt; 0.13 → Run analysis → select highest-priority cluster.</li>
            <li>Find landing sites → select LZ-01 → Plan solar-aware rover route.</li>
            <li>Adjust volume depth/fraction → Export mission package.</li>
            <li>Frame results as potential signatures / planning scenarios — not confirmed ice.</li>
          </ol>
        </GlassCard>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {stage === "select" && busy ? <RocketLoader title="Loading optical frames…" tips={STAGE1_TIPS} /> : null}
      {stage === "select" && !busy ? (
        <GlassCard className="space-y-5">
          <p className="kicker">Stage 1 · Upload optical context</p>
          <p className="text-sm text-[var(--muted)]">
            Same idea as registration: bring lunar imagery into the pipeline first. Stage 3 still labels radar layers as
            illustrative/supplied demo grids.
          </p>
          <div>
            <p className="kicker">How many images?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn ${count === n ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setSlotCount(n)}
                >
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
                  onClick={() => document.getElementById(`ice-slot-${i}`)?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      document.getElementById(`ice-slot-${i}`)?.click();
                    }
                  }}
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
                  <span className="kicker">{i === 0 ? "Reference / context" : `Source ${i} / patch`}</span>
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
                    id={`ice-slot-${i}`}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setSlot(i, e.target.files?.[0] ?? null);
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
            <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={() => void startUpload()}>
              Upload & continue
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void startDemo()}>
              Load demo optical pair
            </button>
            <button type="button" className="btn btn-secondary" onClick={enterMission}>
              Skip to demo mission planner
            </button>
          </div>
        </GlassCard>
      ) : null}

      {stage === "enhance" && busy ? <RocketLoader title="Enhancing optical context…" tips={STAGE2_TIPS} /> : null}
      {stage === "enhance" && !busy && clahe ? (
        <GlassCard className="space-y-4">
          <p className="kicker">Stage 2 · Enhance (CLAHE)</p>
          <p className="text-sm text-[var(--muted)]">
            Optical enhancement for morphology context. Radar CPR/DOP screening happens next on the illustrative crater
            grid.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {clahe.images.map((src, i) => (
              <div key={src}>
                <BeforeAfterSlider beforeSrc={clahe.originals[i]!} afterSrc={src} beforeLabel="Original" afterLabel="Enhanced" />
                <p className="mt-2 text-xs text-[var(--muted)]">{clahe.notes[i]?.note}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={enterMission}>
              Next · Mission planner
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setStage("select")}>
              Back
            </button>
          </div>
          {jobId ? <p className="text-xs text-[var(--muted)]">Optical job linked: {jobId}</p> : null}
        </GlassCard>
      ) : null}

      {stage === "mission" && dataset ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          {/* Left controls */}
          <div className="space-y-4">
            <GlassCard className="space-y-3">
              <p className="kicker">Dataset · synthetic demo</p>
              <p className="text-xs text-[var(--muted)]">{dataset.name}</p>
              <p className="text-[11px] leading-5 text-[var(--muted)]">{dataset.sourceLabel}</p>
              <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
                Stage 3 is a <strong className="text-[var(--text)]">browser mission-planning simulator</strong> on
                illustrative CPR/DOP layers — not calibrated DFSAR ice detection.
              </p>
              <button
                type="button"
                className="btn btn-secondary w-full !min-h-9 text-xs"
                onClick={() => {
                  const moonPhoto =
                    clahe?.images?.[0] ||
                    previews.find((p): p is string => Boolean(p)) ||
                    "/moon-albedo.jpg";
                  const ds = buildDemoCraterDataset(Date.now() % 100000);
                  ds.baseTexture = moonPhoto;
                  setDataset(ds);
                  setIceMask(null);
                  setClusters([]);
                  setSummary(null);
                  setLandings([]);
                  setRoute(null);
                }}
              >
                Reload synthetic crater dataset
              </button>
            </GlassCard>

            <GlassCard className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="kicker">Layers</p>
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-wider text-[var(--accent)]"
                  onClick={() => setLayers(new Set(["cpr", "dop", "psr", "iceCandidates", "roverRoute"]))}
                >
                  Reset layers
                </button>
              </div>
              {ALL_LAYERS.map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 text-xs">
                  <span className="capitalize text-[var(--muted)]">{k.replace(/([A-Z])/g, " $1")}</span>
                  <input type="checkbox" checked={layers.has(k)} onChange={() => toggleLayer(k)} />
                </label>
              ))}
            </GlassCard>

            <GlassCard className="space-y-3">
              <p className="kicker">Radar thresholds</p>
              <p className="text-[11px] leading-5 text-[var(--muted)]">
                IceCandidate = (CPR &gt; {iceParams.cprThreshold.toFixed(2)}) AND (DOP &lt; {iceParams.dopThreshold.toFixed(2)})
                AND DoublyShadowedMask
              </p>
              <label className="block text-xs text-[var(--muted)]">
                CPR threshold ({iceParams.cprThreshold.toFixed(2)})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.01}
                  value={iceParams.cprThreshold}
                  onChange={(e) => setIceParams({ ...iceParams, cprThreshold: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                DOP threshold ({iceParams.dopThreshold.toFixed(2)})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0.02}
                  max={0.5}
                  step={0.01}
                  value={iceParams.dopThreshold}
                  onChange={(e) => setIceParams({ ...iceParams, dopThreshold: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Min cluster cells ({iceParams.minClusterCells})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={4}
                  max={40}
                  step={1}
                  value={iceParams.minClusterCells}
                  onChange={(e) => setIceParams({ ...iceParams, minClusterCells: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={iceParams.roughnessPenaltyEnabled}
                  onChange={(e) => setIceParams({ ...iceParams, roughnessPenaltyEnabled: e.target.checked })}
                />
                Apply terrain roughness penalty
              </label>
              <button type="button" className="btn btn-primary w-full" onClick={runAnalysis}>
                Run candidate screening
              </button>
            </GlassCard>

            <GlassCard className="space-y-3">
              <p className="kicker">Landing constraints</p>
              <p className="text-[11px] text-[var(--muted)]">
                Prototype weighted analysis — not a certified landing safety assessment.
              </p>
              <label className="block text-xs text-[var(--muted)]">
                Preferred slope ° ({landingParams.preferredSlopeDeg})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={1}
                  max={15}
                  value={landingParams.preferredSlopeDeg}
                  onChange={(e) => setLandingParams({ ...landingParams, preferredSlopeDeg: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Reject slope ° ({landingParams.rejectSlopeDeg})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={5}
                  max={25}
                  value={landingParams.rejectSlopeDeg}
                  onChange={(e) => setLandingParams({ ...landingParams, rejectSlopeDeg: Number(e.target.value) })}
                />
              </label>
              <button type="button" className="btn btn-primary w-full" onClick={findLandings} disabled={!selectedCluster}>
                Find landing sites
              </button>
            </GlassCard>

            <GlassCard className="space-y-3">
              <p className="kicker">Route settings</p>
              <div className="flex flex-wrap gap-1">
                {(["science-first", "solar-aware", "battery-supported"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn !min-h-8 !px-2 text-[10px] ${routeParams.mode === m ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setRouteParams({ ...routeParams, mode: m })}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="block text-xs text-[var(--muted)]">
                Battery shadow budget m ({routeParams.batteryShadowBudgetMeters})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={20}
                  max={200}
                  value={routeParams.batteryShadowBudgetMeters}
                  onChange={(e) => setRouteParams({ ...routeParams, batteryShadowBudgetMeters: Number(e.target.value) })}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={planRoute}
                disabled={!selectedLanding || !selectedCluster}
              >
                Plan rover route
              </button>
              {routeError ? <p className="text-xs text-[var(--danger)]">{routeError}</p> : null}
            </GlassCard>
          </div>

          {/* Center map */}
          <div className="space-y-4">
            <LunarMissionMap
              dataset={dataset}
              activeLayers={layers}
              iceMask={iceMask}
              iceConfidence={iceConfidence}
              landingSuitability={landingGrid}
              clusters={clusters}
              selectedCluster={selectedCluster}
              landings={landings}
              selectedLanding={selectedLanding}
              route={route}
              inspect={inspect}
              onCellInspect={(x, y) => setInspect({ x, y })}
              onClusterSelect={setSelectedClusterId}
              onLandingSelect={setSelectedLandingId}
              canvasRef={mapRef}
            />
            {inspectInfo ? (
              <GlassCard className="grid gap-2 text-xs sm:grid-cols-2">
                <p className="kicker sm:col-span-2">Cell inspect · ({inspect!.x}, {inspect!.y})</p>
                <span>CPR {inspectInfo.cpr.toFixed(3)}</span>
                <span>DOP {inspectInfo.dop.toFixed(3)}</span>
                <span>Ice-evidence conf {inspectInfo.conf != null ? inspectInfo.conf.toFixed(3) : "—"}</span>
                <span>Doubly shadowed {inspectInfo.psr ? "Yes" : "No"}</span>
                <span>Slope {inspectInfo.slope.toFixed(1)}°</span>
                <span>Roughness {inspectInfo.roughness.toFixed(2)}</span>
                <span>Hazard {inspectInfo.hazard.toFixed(2)}</span>
                <span>Illumination {inspectInfo.illum.toFixed(2)}</span>
                <span>Landing score {inspectInfo.land != null ? inspectInfo.land.toFixed(1) : "—"}</span>
                <span>On route {inspectInfo.onRoute ? "Yes" : "No"}</span>
              </GlassCard>
            ) : null}
            {clahe ? (
              <GlassCard className="space-y-2">
                <p className="kicker">Optical context (Stage 2)</p>
                <img src={clahe.images[0]} alt="Enhanced optical" className="max-h-48 w-full rounded-xl object-cover grayscale" />
              </GlassCard>
            ) : null}
          </div>

          {/* Right summaries */}
          <div className="space-y-4">
            <GlassCard className="space-y-2">
              <p className="kicker">Ice evidence summary</p>
              {summary ? (
                <>
                  <p className="text-sm font-medium">{summary.quality}</p>
                  <p className="text-xs leading-5 text-[var(--muted)]">{summary.explanation}</p>
                  <p className="text-xs text-[var(--muted)]">Clusters {summary.clusterCount}</p>
                  <p className="text-xs text-[var(--muted)]">Total candidate area {summary.totalCandidateAreaM2.toFixed(0)} m²</p>
                  {summary.bestCluster ? (
                    <p className="text-xs text-[var(--muted)]">
                      Best {summary.bestCluster.id}: CPR {summary.bestCluster.meanCPR.toFixed(2)} · DOP{" "}
                      {summary.bestCluster.meanDOP.toFixed(3)} · conf {(summary.bestCluster.meanConfidence * 100).toFixed(0)}% ·{" "}
                      {summary.bestCluster.priority}
                    </p>
                  ) : null}
                  {summary.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-[var(--warn)]">
                      {w}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Run candidate screening to map potential subsurface-ice signatures on the illustrative layers.
                </p>
              )}
              {clusters.length ? (
                <div className="mt-2 space-y-2">
                  {clusters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                        selectedClusterId === c.id ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "border-[var(--border)]"
                      }`}
                      onClick={() => setSelectedClusterId(c.id)}
                    >
                      <strong>{c.id}</strong> · {c.priority} · {c.areaM2.toFixed(0)} m²
                    </button>
                  ))}
                </div>
              ) : null}
            </GlassCard>

            <GlassCard className="space-y-2">
              <p className="kicker">Landing candidates</p>
              {!landings.length ? (
                <p className="text-xs text-[var(--muted)]">No landing site can be ranked until an ice target cluster is selected.</p>
              ) : (
                landings.map((lz) => (
                  <button
                    key={lz.id}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                      selectedLandingId === lz.id ? "border-[var(--accent)]" : "border-[var(--border)]"
                    }`}
                    onClick={() => setSelectedLandingId(lz.id)}
                  >
                    <div className="flex justify-between gap-2">
                      <strong>{lz.id}</strong>
                      <span>{lz.score}/100 · {lz.status}</span>
                    </div>
                    <p className="mt-1 text-[var(--muted)]">
                      slope {lz.slopeDegrees.toFixed(1)}° · illum {lz.illumination.toFixed(2)} ·{" "}
                      {lz.distanceToTargetMeters.toFixed(0)} m to target
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">{lz.reasons.join(" · ")}</p>
                  </button>
                ))
              )}
            </GlassCard>

            <GlassCard className="space-y-2">
              <p className="kicker">Route summary</p>
              {route ? (
                <>
                  <p className="text-xs">
                    Mode {routeParams.mode} · {route.feasibility}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {route.distanceMeters.toFixed(0)} m · max slope {route.maxSlopeDegrees.toFixed(1)}° · mean{" "}
                    {route.meanSlopeDegrees.toFixed(1)}°
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Shadow {route.shadowDistanceMeters.toFixed(0)} m ({(route.shadowFraction * 100).toFixed(0)}%) · hazards{" "}
                    {route.hazardCellsEncountered}
                  </p>
                  <p className="text-[11px] leading-5 text-[var(--muted)]">
                    Solar-aware mode applies a higher cost to low-illumination cells; battery-supported mode permits limited
                    dark traversal under a configurable budget.
                  </p>
                  {route.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-[var(--warn)]">
                      {w}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-[var(--muted)]">Plan a rover route after selecting LZ and ice target.</p>
              )}
            </GlassCard>

            <GlassCard className="space-y-3">
              <p className="kicker">Scenario-based ice-volume estimate · not a measurement</p>
              <p className="text-[11px] leading-5 text-[var(--muted)]">
                This is a scenario-based resource estimate using mapped candidate area and user-controlled assumptions. Radar
                evidence does not directly measure ice depth or concentration.
              </p>
              <label className="block text-xs text-[var(--muted)]">
                Assumed depth 0–5 m ({volumeParams.assumedDepthMeters.toFixed(1)})
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={volumeParams.assumedDepthMeters}
                  onChange={(e) => setVolumeParams({ ...volumeParams, assumedDepthMeters: Number(e.target.value) })}
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Ice fraction 0–100% ({(volumeParams.iceFraction * 100).toFixed(0)}%)
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeParams.iceFraction}
                  onChange={(e) => setVolumeParams({ ...volumeParams, iceFraction: Number(e.target.value) })}
                />
              </label>
              <div className="space-y-2">
                {volumes.map((v) => (
                  <div key={v.label} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
                    <strong>{v.label}</strong>
                    <p className="text-[var(--muted)]">
                      {v.volumeM3.toFixed(0)} m³ · {(v.massKg / 1000).toFixed(1)} t
                      {v.label !== "Custom" ? ` · depth ${v.depthMeters} m · ${(v.iceFraction * 100).toFixed(0)}%` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="space-y-2">
              <p className="kicker">Assumptions / limitations</p>
              <ul className="space-y-1 text-[11px] leading-5 text-[var(--muted)]">
                <li>Illustrative / supplied demo layers — not calibrated DFSAR.</li>
                <li>Radar thresholds identify potential subsurface-ice signatures, not confirmed ice.</li>
                <li>Landing result is a prototype suitability score.</li>
                <li>Route is grid-based planning support, not mission certification.</li>
                <li>Volume is scenario-based and assumption-dependent (0–5 m depth).</li>
              </ul>
              <IceLunaGuide
                cpr={selectedCluster?.meanCPR}
                dop={selectedCluster?.meanDOP}
                shadowed
                cprThr={iceParams.cprThreshold}
                dopThr={iceParams.dopThreshold}
                route={
                  route
                    ? {
                        mode: routeParams.mode,
                        distanceM: route.distanceMeters,
                        meanSlope: route.meanSlopeDegrees,
                        shadowFraction: route.shadowFraction,
                        hazardCells: route.hazardCellsEncountered,
                        feasibility: route.feasibility,
                      }
                    : null
                }
              />
              <button type="button" className="btn btn-primary w-full" onClick={() => void exportPackage()}>
                Download mission package (.zip)
              </button>
              <IcePlatformPersist
                thresholds={{ cpr: iceParams.cprThreshold, dop: iceParams.dopThreshold }}
                clusterMetrics={
                  selectedCluster
                    ? { meanCPR: selectedCluster.meanCPR, meanDOP: selectedCluster.meanDOP, id: selectedCluster.id }
                    : {}
                }
                volumeScenarios={{ volumes }}
                landingCandidates={landings.map((s) => ({
                  name: s.id,
                  score: s.score,
                  metrics: { status: s.status },
                }))}
                roverRoutes={
                  route
                    ? [
                        {
                          name: "planned",
                          mode: routeParams.mode,
                          geojson: { type: "Feature", properties: {}, geometry: null },
                          metrics: {
                            distanceMeters: route.distanceMeters,
                            meanSlopeDegrees: route.meanSlopeDegrees,
                            shadowFraction: route.shadowFraction,
                            feasibility: route.feasibility,
                          },
                        },
                      ]
                    : []
                }
              />
              <button type="button" className="btn btn-secondary w-full" onClick={() => setStage("enhance")}>
                Back to enhance
              </button>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

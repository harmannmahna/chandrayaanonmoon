import { useEffect, useMemo, useRef, type MouseEvent, type RefObject } from "react";
import type {
  BooleanGrid,
  CraterDataset,
  Grid,
  IceCandidateCluster,
  LandingCandidate,
  LayerKey,
  RoverRoute,
} from "../../lib/ice/types";

type Props = {
  dataset: CraterDataset;
  activeLayers: Set<LayerKey>;
  iceMask: BooleanGrid | null;
  iceConfidence: Grid | null;
  landingSuitability: Grid | null;
  clusters: IceCandidateCluster[];
  selectedCluster: IceCandidateCluster | null;
  landings: LandingCandidate[];
  selectedLanding: LandingCandidate | null;
  route: RoverRoute | null;
  inspect: { x: number; y: number } | null;
  onCellInspect: (x: number, y: number) => void;
  onClusterSelect: (id: string) => void;
  onLandingSelect: (id: string) => void;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
};

function heat(t: number, mode: "cpr" | "dop" | "conf" | "land" | "haz" | "illum") {
  const u = Math.max(0, Math.min(1, t));
  if (mode === "cpr") return `rgba(${Math.round(40 + u * 200)},${Math.round(80 + u * 40)},${Math.round(200 - u * 160)},0.72)`;
  if (mode === "dop") return `rgba(${Math.round(20 + u * 40)},${Math.round(120 + u * 80)},${Math.round(180 - u * 40)},0.7)`;
  if (mode === "conf") return `rgba(${Math.round(20 + u * 40)},${Math.round(160 + u * 70)},${Math.round(220)},${0.25 + u * 0.55})`;
  if (mode === "land") return `rgba(${Math.round(20 + u * 40)},${Math.round(160 + u * 90)},${Math.round(60 + u * 40)},${0.2 + u * 0.55})`;
  if (mode === "haz") return `rgba(${Math.round(200 + u * 55)},${Math.round(80 - u * 40)},30,${0.25 + u * 0.5})`;
  return `rgba(255,${Math.round(200 + u * 40)},${Math.round(120 + u * 80)},${0.15 + u * 0.45})`;
}

export function LunarMissionMap({
  dataset,
  activeLayers,
  iceMask,
  iceConfidence,
  landingSuitability,
  clusters,
  selectedCluster,
  landings,
  selectedLanding,
  route,
  inspect,
  onCellInspect,
  onClusterSelect,
  onLandingSelect,
  canvasRef: externalRef,
}: Props) {
  const localRef = useRef<HTMLCanvasElement>(null);
  const ref = externalRef ?? localRef;
  const scale = useMemo(() => 3, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width: w, height: h } = dataset;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a0e18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawGrid = (grid: Grid, mode: "cpr" | "dop" | "conf" | "land" | "haz" | "illum", gain = 1) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = grid.values[y * w + x]!;
          let t = v;
          if (mode === "cpr") t = Math.min(1, Math.max(0, (v - 0.3) / 1.5));
          if (mode === "dop") t = Math.min(1, Math.max(0, v / 0.6));
          if (mode === "conf" || mode === "land") t = mode === "land" ? v / 100 : v;
          if (mode === "haz" || mode === "illum") t = v;
          ctx.fillStyle = heat(t * gain, mode);
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    };

    // Base grayscale from illumination + slope
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const g = Math.round(30 + dataset.illumination.values[i]! * 140 - dataset.slopeDegrees.values[i]! * 2);
        ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 8)})`;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    if (activeLayers.has("cpr")) drawGrid(dataset.cpr, "cpr");
    if (activeLayers.has("dop")) drawGrid(dataset.dop, "dop");
    if (activeLayers.has("illumination")) drawGrid(dataset.illumination, "illum");
    if (activeLayers.has("slope")) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = Math.min(1, dataset.slopeDegrees.values[y * w + x]! / 25);
          ctx.fillStyle = `rgba(180,120,40,${0.15 + t * 0.45})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("roughness")) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = dataset.roughness.values[y * w + x]!;
          ctx.fillStyle = `rgba(160,100,200,${0.1 + t * 0.45})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("hazard")) drawGrid(dataset.hazard, "haz");

    if (activeLayers.has("psr")) {
      ctx.fillStyle = "rgba(90,70,180,0.35)";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (dataset.doublyShadowedMask.values[y * w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      ctx.strokeStyle = "rgba(170,150,255,0.8)";
      ctx.lineWidth = 1;
    }

    if (activeLayers.has("iceCandidates") && iceMask) {
      ctx.fillStyle = "rgba(80,230,210,0.55)";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (iceMask.values[y * w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("iceConfidence") && iceConfidence) drawGrid(iceConfidence, "conf");
    if (activeLayers.has("landingSuitability") && landingSuitability) drawGrid(landingSuitability, "land");

    for (const c of clusters) {
      const sel = selectedCluster?.id === c.id;
      ctx.strokeStyle = sel ? "#facc15" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = sel ? 2 : 1;
      for (const cell of c.cells) {
        ctx.strokeRect(cell.x * scale + 0.5, cell.y * scale + 0.5, scale - 1, scale - 1);
      }
    }

    for (const lz of landings) {
      const sel = selectedLanding?.id === lz.id;
      const px = lz.x * scale + scale / 2;
      const py = lz.y * scale + scale / 2;
      ctx.beginPath();
      ctx.arc(px, py, sel ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#4ade80" : "#86efac";
      ctx.fill();
      ctx.strokeStyle = "#052e16";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "10px sans-serif";
      ctx.fillText(lz.id, px + 6, py - 4);
    }

    if (activeLayers.has("roverRoute") && route) {
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      route.cells.forEach((c, i) => {
        const px = c.x * scale + scale / 2;
        const py = c.y * scale + scale / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    if (inspect) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(inspect.x * scale, inspect.y * scale, scale, scale);
    }
  }, [
    dataset,
    activeLayers,
    iceMask,
    iceConfidence,
    landingSuitability,
    clusters,
    selectedCluster,
    landings,
    selectedLanding,
    route,
    inspect,
    scale,
    ref,
  ]);

  const onClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * dataset.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * dataset.height);
    if (x < 0 || y < 0 || x >= dataset.width || y >= dataset.height) return;
    onCellInspect(x, y);
    for (const c of clusters) {
      if (c.cells.some((p) => p.x === x && p.y === y)) {
        onClusterSelect(c.id);
        break;
      }
    }
    for (const lz of landings) {
      if (Math.hypot(lz.x - x, lz.y - y) <= 2) {
        onLandingSelect(lz.id);
        break;
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black/40">
      <canvas
        ref={ref}
        className="h-auto w-full cursor-crosshair"
        style={{ imageRendering: "pixelated" }}
        onClick={onClick}
      />
      <p className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        Click to inspect · {dataset.sourceLabel}
      </p>
    </div>
  );
}

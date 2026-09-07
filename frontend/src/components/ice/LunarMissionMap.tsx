import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from "react";
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

function heat(t: number, mode: "cpr" | "dop" | "conf" | "land" | "haz" | "illum", soft: boolean) {
  const u = Math.max(0, Math.min(1, t));
  const a = soft ? 0.28 : 0.55;
  if (mode === "cpr") return `rgba(${Math.round(60 + u * 190)},${Math.round(90 + u * 50)},${Math.round(220 - u * 140)},${a + u * 0.25})`;
  if (mode === "dop") return `rgba(${Math.round(30 + u * 40)},${Math.round(140 + u * 70)},${Math.round(200 - u * 40)},${a + u * 0.2})`;
  if (mode === "conf") return `rgba(40,${Math.round(180 + u * 50)},230,${0.15 + u * (soft ? 0.35 : 0.55)})`;
  if (mode === "land") return `rgba(40,${Math.round(180 + u * 70)},80,${0.12 + u * (soft ? 0.35 : 0.5)})`;
  if (mode === "haz") return `rgba(${Math.round(220 + u * 35)},${Math.round(70 - u * 30)},20,${0.18 + u * 0.4})`;
  return `rgba(255,${Math.round(210 + u * 30)},${Math.round(140 + u * 60)},${0.12 + u * 0.35})`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
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
  const scale = useMemo(() => 4, []);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const photoSrc = dataset.baseTexture || "/moon-albedo.jpg";

  useEffect(() => {
    let cancelled = false;
    setBaseImg(null);
    void loadImage(photoSrc)
      .then((img) => {
        if (!cancelled) setBaseImg(img);
      })
      .catch(() => {
        if (!cancelled) {
          void loadImage("/full-moon.png")
            .then((img) => {
              if (!cancelled) setBaseImg(img);
            })
            .catch(() => {
              if (!cancelled) setBaseImg(null);
            });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width: w, height: h } = dataset;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    const soft = Boolean(baseImg);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1) Moon photo (or grayscale fallback)
    if (baseImg) {
      ctx.fillStyle = "#05070f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const iw = baseImg.naturalWidth || baseImg.width;
      const ih = baseImg.naturalHeight || baseImg.height;
      const cover = Math.max(canvas.width / iw, canvas.height / ih);
      const dw = iw * cover;
      const dh = ih * cover;
      const dx = (canvas.width - dw) / 2;
      const dy = (canvas.height - dh) / 2;
      ctx.drawImage(baseImg, dx, dy, dw, dh);
      // Slight darken so overlays stay readable
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const g = Math.round(28 + dataset.illumination.values[i]! * 150 - dataset.slopeDegrees.values[i]! * 2);
          ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 10)})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    const drawGrid = (grid: Grid, mode: "cpr" | "dop" | "conf" | "land" | "haz" | "illum") => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = grid.values[y * w + x]!;
          let t = v;
          if (mode === "cpr") t = Math.min(1, Math.max(0, (v - 0.3) / 1.5));
          if (mode === "dop") t = Math.min(1, Math.max(0, v / 0.6));
          if (mode === "conf" || mode === "land") t = mode === "land" ? v / 100 : v;
          if (mode === "haz" || mode === "illum") t = v;
          ctx.fillStyle = heat(t, mode, soft);
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    };

    if (activeLayers.has("cpr")) drawGrid(dataset.cpr, "cpr");
    if (activeLayers.has("dop")) drawGrid(dataset.dop, "dop");
    if (activeLayers.has("illumination")) drawGrid(dataset.illumination, "illum");
    if (activeLayers.has("slope")) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = Math.min(1, dataset.slopeDegrees.values[y * w + x]! / 25);
          ctx.fillStyle = `rgba(210,150,40,${(soft ? 0.12 : 0.18) + t * 0.35})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("roughness")) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = dataset.roughness.values[y * w + x]!;
          ctx.fillStyle = `rgba(170,110,220,${(soft ? 0.08 : 0.12) + t * 0.35})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("hazard")) drawGrid(dataset.hazard, "haz");

    // PSR mask — translucent violet wash + crisp rim
    if (activeLayers.has("psr")) {
      ctx.fillStyle = soft ? "rgba(90,70,200,0.32)" : "rgba(90,70,180,0.35)";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (dataset.doublyShadowedMask.values[y * w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      // Outline crater boundary
      ctx.strokeStyle = "rgba(196,181,253,0.95)";
      ctx.lineWidth = 2;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!dataset.doublyShadowedMask.values[i]) continue;
          const edge =
            !dataset.doublyShadowedMask.values[i - 1] ||
            !dataset.doublyShadowedMask.values[i + 1] ||
            !dataset.doublyShadowedMask.values[i - w] ||
            !dataset.doublyShadowedMask.values[i + w];
          if (edge) ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
        }
      }
    }

    if (activeLayers.has("iceCandidates") && iceMask) {
      ctx.fillStyle = soft ? "rgba(45,212,191,0.55)" : "rgba(80,230,210,0.55)";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (iceMask.values[y * w + x]) ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    if (activeLayers.has("iceConfidence") && iceConfidence) drawGrid(iceConfidence, "conf");
    if (activeLayers.has("landingSuitability") && landingSuitability) drawGrid(landingSuitability, "land");

    // Clusters — filled halo + outline for readability on photo
    for (const c of clusters) {
      const sel = selectedCluster?.id === c.id;
      ctx.fillStyle = sel ? "rgba(250,204,21,0.28)" : "rgba(255,255,255,0.12)";
      for (const cell of c.cells) {
        ctx.fillRect(cell.x * scale, cell.y * scale, scale, scale);
      }
      ctx.strokeStyle = sel ? "#facc15" : "rgba(255,255,255,0.75)";
      ctx.lineWidth = sel ? 2.5 : 1.5;
      const cx = c.centroid.x * scale;
      const cy = c.centroid.y * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, sel ? 10 : 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(cx + 8, cy - 16, 52, 14);
      ctx.fillStyle = sel ? "#facc15" : "#ffffff";
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(c.id, cx + 12, cy - 5);
    }

    // Landing markers
    for (const lz of landings) {
      const sel = selectedLanding?.id === lz.id;
      const px = lz.x * scale + scale / 2;
      const py = lz.y * scale + scale / 2;
      ctx.beginPath();
      ctx.arc(px, py, sel ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#4ade80" : "#bbf7d0";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#052e16";
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(px + 8, py - 18, 44, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(lz.id, px + 12, py - 7);
    }

    if (activeLayers.has("roverRoute") && route && route.cells.length) {
      // Glow then bright stroke
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      route.cells.forEach((c, i) => {
        const px = c.x * scale + scale / 2;
        const py = c.y * scale + scale / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 3;
      ctx.stroke();
      const start = route.cells[0]!;
      const end = route.cells[route.cells.length - 1]!;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(start.x * scale + scale / 2, start.y * scale + scale / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(end.x * scale + scale / 2, end.y * scale + scale / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (inspect) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(inspect.x * scale, inspect.y * scale, scale, scale);
    }

    // Legend bar
    const legendY = canvas.height - 28;
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, legendY, canvas.width, 28);
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    const items: Array<[string, string]> = [
      ["#c4b5fd", "PSR / doubly shadowed"],
      ["#2dd4bf", "Ice candidate"],
      ["#4ade80", "Landing (LZ)"],
      ["#fde047", "Rover route"],
    ];
    let lx = 10;
    for (const [color, label] of items) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, legendY + 9, 10, 10);
      ctx.fillStyle = "#f4f7ff";
      ctx.fillText(label, lx + 14, legendY + 18);
      lx += ctx.measureText(label).width + 32;
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
    baseImg,
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
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black/50 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text)]">Mission map</p>
        <p className="text-[10px] text-[var(--muted)]">
          {dataset.baseTexture ? "Using your uploaded / enhanced moon photo as base" : "Using demo moon albedo base"}
        </p>
      </div>
      <canvas
        ref={ref}
        className="h-auto w-full cursor-crosshair"
        style={{ imageRendering: "auto" }}
        onClick={onClick}
      />
      <p className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
        Click to inspect · Violet = shadowed crater · Teal = ice candidate · Green = LZ · Yellow = route ·{" "}
        {dataset.sourceLabel}
      </p>
    </div>
  );
}

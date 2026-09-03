import type { GridCoverageResult } from "@/app/lib/metrics/spatialCoverage";
import type { RegistrationQuality } from "@/app/lib/metrics/qualityRules";
import type { GroundTruthValidation } from "@/app/lib/metrics/groundTruth";
import type { RefinedMatch, SubPixelSummary } from "@/app/lib/refine/subPixelRefinement";

export type { SensorType, SensorModality, SensorInfo } from "./sensor";
export { SENSOR_CONTEXT, formatGSD } from "./sensor";

/** Image slot keys used throughout the three-way pipeline. */
export type ImageKey = "A" | "B" | "C";
export type PairId = "AB" | "AC" | "BC";

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Demo / upload image descriptor.
 * `sensorInfo` is mandatory for demo sets and optional for arbitrary user uploads.
 */
export interface ImageDescriptor {
  src: string;
  /** Optional display name for uploads / exports. */
  name?: string;
  /** Present for curated demo products; optional for user uploads. */
  sensorInfo?: import("./sensor").SensorInfo;
}

export interface DemoSetDescriptor {
  id: string;
  title: string;
  description: string;
  images: Record<ImageKey, ImageDescriptor>;
  /** Present for synthetic demos with known transform. */
  groundTruth?: {
    pairId: PairId;
    H_gt: number[][];
    note?: string;
  };
}

export interface LoadedImage {
  key: ImageKey;
  fileName: string;
  /** Browser ImageData used by the in-browser pipeline. */
  imageData: ImageData;
  /** Preview URL (object URL or data URL). */
  previewUrl: string;
  /** Optional sensor metadata carried through the pipeline. */
  sensorInfo?: import("./sensor").SensorInfo;
  /** True when the product was decoded from XML / non-PNG input. */
  convertedFrom?: string;
  originalWidth?: number;
  originalHeight?: number;
}

export interface Match {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence?: number;
}

export interface MatchResult {
  matches: Match[];
  method: string;
}

export interface RANSACResult {
  H: number[][] | null;
  inliers: Match[];
  outlierCount: number;
}

export interface MetricsResult {
  rmse: number;
  refinedRmse?: number;
  inlierRatio: number;
  inlierCount: number;
  totalMatches: number;
  coverage: number;
  occupiedCells: number;
  cellCounts: number[];
  confidence: "HIGH" | "MED" | "LOW";
  gridCoverage: GridCoverageResult;
  quality: RegistrationQuality;
  uniformRegistration: boolean;
  subPixel?: SubPixelSummary;
  groundTruth?: GroundTruthValidation;
}

export interface PairPipelineResult {
  pairId: PairId;
  left: ImageKey;
  right: ImageKey;
  matches: Match[];
  method: string;
  ransac: RANSACResult;
  refinedMatches?: RefinedMatch[];
  metrics: MetricsResult;
  warpedPreviewUrl?: string;
  overlayPreviewUrl?: string;
  coverageHeatmapUrl?: string;
}

export const PAIR_DEFS: { id: PairId; left: ImageKey; right: ImageKey; label: string }[] = [
  { id: "AB", left: "A", right: "B", label: "A ↔ B" },
  { id: "AC", left: "A", right: "C", label: "A ↔ C" },
  { id: "BC", left: "B", right: "C", label: "B ↔ C" },
];

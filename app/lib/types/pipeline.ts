import type { SensorInfo } from "./sensor";

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
  sensorInfo?: SensorInfo;
}

export interface DemoSetDescriptor {
  id: string;
  title: string;
  description: string;
  images: Record<ImageKey, ImageDescriptor>;
}

export interface LoadedImage {
  key: ImageKey;
  fileName: string;
  /** Browser ImageData used by the in-browser pipeline. */
  imageData: ImageData;
  /** Preview URL (object URL or data URL). */
  previewUrl: string;
  /** Optional sensor metadata carried through the pipeline. */
  sensorInfo?: SensorInfo;
  /** True when the product was decoded from XML / non-PNG input. */
  convertedFrom?: string;
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
  inlierRatio: number;
  inlierCount: number;
  totalMatches: number;
  coverage: number;
  occupiedCells: number;
  cellCounts: number[];
  confidence: "HIGH" | "MED" | "LOW";
}

export interface PairPipelineResult {
  pairId: PairId;
  left: ImageKey;
  right: ImageKey;
  matches: Match[];
  ransac: RANSACResult;
  metrics: MetricsResult;
  warpedPreviewUrl?: string;
  overlayPreviewUrl?: string;
}

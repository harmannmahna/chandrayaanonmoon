/** LUNA/ICE shared types — browser-only analysis (planning support, not mission certification). */

export type Grid = {
  width: number;
  height: number;
  cellSizeMeters: number;
  values: Float32Array;
};

export type BooleanGrid = {
  width: number;
  height: number;
  values: Uint8Array;
};

export type CraterDataset = {
  id: string;
  name: string;
  description: string;
  sourceLabel: string;
  isSynthetic: boolean;
  width: number;
  height: number;
  cellSizeMeters: number;
  cpr: Grid;
  dop: Grid;
  slopeDegrees: Grid;
  roughness: Grid;
  illumination: Grid;
  hazard: Grid;
  doublyShadowedMask: BooleanGrid;
  baseTexture?: string;
};

export type IceAnalysisParams = {
  cprThreshold: number;
  dopThreshold: number;
  minClusterCells: number;
  confidenceThreshold: number;
  roughnessPenaltyEnabled: boolean;
};

export type IceCandidateCluster = {
  id: string;
  cells: Array<{ x: number; y: number }>;
  areaM2: number;
  centroid: { x: number; y: number };
  meanCPR: number;
  meanDOP: number;
  meanConfidence: number;
  meanSlope: number;
  priority: "High" | "Medium" | "Low";
};

export type LandingParams = {
  preferredSlopeDeg: number;
  rejectSlopeDeg: number;
  slopeWeight: number;
  roughnessWeight: number;
  hazardWeight: number;
  illuminationWeight: number;
  targetDistanceWeight: number;
  psrPenalty: number;
  craterBufferCells: number;
};

export type LandingCandidate = {
  id: string;
  x: number;
  y: number;
  score: number;
  slopeDegrees: number;
  roughness: number;
  illumination: number;
  hazard: number;
  distanceToTargetMeters: number;
  status: "Preferred" | "Feasible" | "Risky" | "Rejected";
  reasons: string[];
};

export type RouteMode = "science-first" | "solar-aware" | "battery-supported";

export type RouteParams = {
  mode: RouteMode;
  maxRoverSlopeDeg: number;
  hardRejectSlopeDeg: number;
  slopeWeight: number;
  roughnessWeight: number;
  hazardWeight: number;
  shadowWeight: number;
  distanceWeight: number;
  batteryShadowBudgetMeters: number;
};

export type RoverRoute = {
  cells: Array<{ x: number; y: number }>;
  distanceMeters: number;
  maxSlopeDegrees: number;
  meanSlopeDegrees: number;
  shadowDistanceMeters: number;
  shadowFraction: number;
  hazardCellsEncountered: number;
  estimatedCost: number;
  feasibility: "Feasible" | "Conditional" | "Infeasible";
  warnings: string[];
};

export type VolumeParams = {
  assumedDepthMeters: number;
  iceFraction: number;
  densityKgPerM3: number;
};

export type VolumeScenario = {
  label: "Conservative" | "Nominal" | "Optimistic" | "Custom";
  areaM2: number;
  depthMeters: number;
  iceFraction: number;
  volumeM3: number;
  massKg: number;
};

export type IceAppQuality =
  | "High Evidence"
  | "Moderate Evidence"
  | "Low Evidence"
  | "Insufficient Data";

export type LayerKey =
  | "cpr"
  | "dop"
  | "psr"
  | "slope"
  | "roughness"
  | "hazard"
  | "illumination"
  | "iceCandidates"
  | "iceConfidence"
  | "landingSuitability"
  | "roverRoute";

export type IceEvidenceSummary = {
  totalCandidateAreaM2: number;
  clusterCount: number;
  bestCluster: IceCandidateCluster | null;
  quality: IceAppQuality;
  warnings: string[];
  explanation: string;
};

export const DEFAULT_ICE_PARAMS: IceAnalysisParams = {
  cprThreshold: 1.0,
  dopThreshold: 0.13,
  minClusterCells: 12,
  confidenceThreshold: 0.35,
  roughnessPenaltyEnabled: true,
};

export const DEFAULT_LANDING_PARAMS: LandingParams = {
  preferredSlopeDeg: 5,
  rejectSlopeDeg: 10,
  slopeWeight: 0.28,
  roughnessWeight: 0.18,
  hazardWeight: 0.22,
  illuminationWeight: 0.18,
  targetDistanceWeight: 0.14,
  psrPenalty: 1,
  craterBufferCells: 4,
};

export const DEFAULT_ROUTE_PARAMS: RouteParams = {
  mode: "solar-aware",
  maxRoverSlopeDeg: 14,
  hardRejectSlopeDeg: 22,
  slopeWeight: 1.2,
  roughnessWeight: 0.9,
  hazardWeight: 2.0,
  shadowWeight: 1.4,
  distanceWeight: 1.0,
  batteryShadowBudgetMeters: 80,
};

export const DEFAULT_VOLUME_PARAMS: VolumeParams = {
  assumedDepthMeters: 3,
  iceFraction: 0.3,
  densityKgPerM3: 917,
};

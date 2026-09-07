/** Mission-intelligence shared types (Register experiment tracking + reliability). */

export type MatcherEngine = "akaze" | "superpoint-lightglue" | "loftr";

export type EngineStatus = "available" | "loading" | "unavailable" | "fallback";

export type MatcherEngineInfo = {
  engine: MatcherEngine;
  label: string;
  ui_label: string;
  description: string;
  available: boolean;
  status: EngineStatus | string;
  detail?: string;
};

export type ReliabilityResult = {
  score: number;
  trust_label: string;
  reasons: string[];
  limitation: string;
};

export type RunRecord = {
  id: string;
  timestamp: string;
  inputPair: {
    jobId: string | null;
    sourceIndex: number;
    inputDataStatus: string;
    count?: number;
  };
  engineRequested: MatcherEngine;
  engineUsed: MatcherEngine | string;
  fallbackUsed: boolean;
  preprocessing: { clahe: boolean; clipLimit?: number };
  ransacParams: { reprojThresholdPx: number; note: string };
  matchStats: {
    rawMatches: number;
    meanConfidence?: number;
    runtimeMs?: number;
    matcherLabel?: string;
  };
  metrics: {
    inlierCount: number;
    inlierRatio: number;
    rmsePx: number;
    spatialCoverage: number;
    rotationDeg?: number;
    scale?: number;
  };
  quality: ReliabilityResult | null;
  outputStatus: string;
  previewUrls?: {
    matches?: string;
    unmatched?: string;
    overlay?: string;
    tint?: string;
  };
};

export type LineageStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  detail?: string;
};

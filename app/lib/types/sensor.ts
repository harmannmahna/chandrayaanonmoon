/**
 * Chandrayaan-2 / LRO sensor metadata shared across demo sets and uploads.
 */

export type SensorType = "OHRC" | "LRO_NAC" | "TMC2" | "IIRS" | "OTHER";

export type SensorModality = "panchromatic" | "hyperspectral-derived" | "other";

export interface SensorInfo {
  /** Sensor / product family. */
  type: SensorType;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Approximate ground sample distance in metres per pixel. */
  approxGSD: number;
  /** Imaging modality. */
  modality: SensorModality;
  /** Optional short context for judges / operators. */
  notes?: string;
}

/** Canonical reference cards used by the Mission Context panel. */
export const SENSOR_CONTEXT: Record<Exclude<SensorType, "OTHER">, SensorInfo & { summary: string }> = {
  OHRC: {
    type: "OHRC",
    label: "OHRC (Chandrayaan-2)",
    approxGSD: 0.3,
    modality: "panchromatic",
    notes: "Orbiter High Resolution Camera.",
    summary:
      "≈0.25–0.32 m/px panchromatic imagery used for high-resolution mapping and landing-site analysis.",
  },
  LRO_NAC: {
    type: "LRO_NAC",
    label: "LRO NAC",
    approxGSD: 0.5,
    modality: "panchromatic",
    notes: "Lunar Reconnaissance Orbiter Narrow Angle Camera.",
    summary:
      "≈0.5 m/px (typical) panchromatic reference mapping widely used for lunar cartography and change detection.",
  },
  TMC2: {
    type: "TMC2",
    label: "TMC-2 (Chandrayaan-2)",
    approxGSD: 5,
    modality: "panchromatic",
    notes: "Terrain Mapping Camera-2 stereo product.",
    summary:
      "≈5 m/px stereo panchromatic imagery supporting topographic mapping and DEM generation.",
  },
  IIRS: {
    type: "IIRS",
    label: "IIRS (Chandrayaan-2)",
    approxGSD: 80,
    modality: "hyperspectral-derived",
    notes: "Imaging Infrared Spectrometer mineralogical product (often derived / resampled for demo).",
    summary:
      "Hyperspectral coverage ~0.8–5.0 μm for mineralogical mapping; demos may use a derived grayscale proxy.",
  },
};

export function formatGSD(metresPerPixel: number): string {
  if (metresPerPixel < 1) return `${metresPerPixel.toFixed(2)} m/px`;
  if (metresPerPixel < 10) return `${metresPerPixel.toFixed(1)} m/px`;
  return `${Math.round(metresPerPixel)} m/px`;
}

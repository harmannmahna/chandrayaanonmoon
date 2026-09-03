export type RegistrationQuality = "High" | "Medium" | "Low" | "Unreliable";

export interface QualityInput {
  rmse: number;
  inlierRatio: number;
  inlierCount: number;
  occupiedCells?: number;
  gridCoverage?: { filledCells: number };
}

/**
 * Rule-based registration quality label.
 * Avoids always presenting a confident result when evidence is weak.
 */
export function assessRegistrationQuality(metrics: QualityInput): RegistrationQuality {
  const filled = metrics.gridCoverage?.filledCells ?? metrics.occupiedCells ?? 0;

  if (metrics.inlierRatio < 0.25 || metrics.inlierCount < 12 || metrics.rmse > 5) {
    return "Unreliable";
  }
  if (metrics.rmse > 3 || filled < 6 || metrics.inlierCount < 20) {
    return "Low";
  }
  if (metrics.rmse <= 1.5 && metrics.inlierRatio >= 0.55 && filled >= 8) {
    return "High";
  }
  return "Medium";
}

export function qualityTone(quality: RegistrationQuality): "good" | "warn" | "bad" {
  if (quality === "High") return "good";
  if (quality === "Unreliable") return "bad";
  return "warn";
}

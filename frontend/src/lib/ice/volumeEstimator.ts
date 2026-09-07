import type { VolumeParams, VolumeScenario } from "./types";

/**
 * V_ice = A_candidate × depth × iceFraction
 * M_ice = V_ice × 917 kg/m³
 *
 * Scenario-based resource estimate — radar evidence does not directly measure
 * ice depth or concentration.
 */
export function computeIceVolumeScenario(
  candidateAreaM2: number,
  params: VolumeParams,
  label: VolumeScenario["label"],
): VolumeScenario {
  if (candidateAreaM2 < 0) throw new Error("Candidate area must be non-negative.");
  if (params.assumedDepthMeters < 0 || params.assumedDepthMeters > 5) {
    throw new Error("Assumed depth must be between 0 and 5 metres.");
  }
  if (params.iceFraction < 0 || params.iceFraction > 1) {
    throw new Error("Ice fraction must be between 0 and 1.");
  }
  const volumeM3 = candidateAreaM2 * params.assumedDepthMeters * params.iceFraction;
  const massKg = volumeM3 * params.densityKgPerM3;
  return {
    label,
    areaM2: candidateAreaM2,
    depthMeters: params.assumedDepthMeters,
    iceFraction: params.iceFraction,
    volumeM3,
    massKg,
  };
}

export function getDefaultScenarios(candidateAreaM2: number, densityKgPerM3 = 917): VolumeScenario[] {
  return [
    computeIceVolumeScenario(candidateAreaM2, { assumedDepthMeters: 1, iceFraction: 0.1, densityKgPerM3 }, "Conservative"),
    computeIceVolumeScenario(candidateAreaM2, { assumedDepthMeters: 3, iceFraction: 0.3, densityKgPerM3 }, "Nominal"),
    computeIceVolumeScenario(candidateAreaM2, { assumedDepthMeters: 5, iceFraction: 0.6, densityKgPerM3 }, "Optimistic"),
  ];
}

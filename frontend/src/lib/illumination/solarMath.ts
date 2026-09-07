import type { PhaseName, RegistrationDifficulty, SunState } from "./types";

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Unit sun direction in world coords (x right, y up, z toward viewer). */
export function getSunDirection(sun: SunState): [number, number, number] {
  const el = degreesToRadians(sun.elevationDeg);
  const az = degreesToRadians(sun.azimuthDeg);
  const cosEl = Math.cos(el);
  const x = cosEl * Math.sin(az);
  const y = Math.sin(el);
  const z = cosEl * Math.cos(az);
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export function getPhaseName(phaseDeg: number): PhaseName {
  const a = ((phaseDeg % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Third Quarter";
  return "Waning Crescent";
}

/** Approximate illuminated fraction of the lunar disk from phase angle (0–360). */
export function getIlluminatedFraction(phaseDeg: number): number {
  const a = degreesToRadians(((phaseDeg % 360) + 360) % 360);
  return 0.5 * (1 - Math.cos(a));
}

export function calculateRegistrationDifficulty(sunA: SunState, sunB: SunState): RegistrationDifficulty {
  const dEl = Math.abs(sunA.elevationDeg - sunB.elevationDeg);
  let dAz = Math.abs(sunA.azimuthDeg - sunB.azimuthDeg) % 360;
  if (dAz > 180) dAz = 360 - dAz;
  const score = dEl * 1.2 + dAz * 0.35;
  if (score < 25) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

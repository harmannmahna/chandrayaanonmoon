/** Shared types for Lunar Illumination Explorer (educational / illustrative). */

export type SunState = {
  elevationDeg: number;
  azimuthDeg: number;
};

export type TerrainGrid = {
  width: number;
  height: number;
  heights: Float32Array;
};

export type IlluminationGrid = {
  width: number;
  height: number;
  brightness: Float32Array;
  shadowMask: Uint8Array;
};

export type IlluminationStats = {
  litFraction: number;
  shadowFraction: number;
  meanBrightness: number;
};

export type PhaseName =
  | "New Moon"
  | "Waxing Crescent"
  | "First Quarter"
  | "Waxing Gibbous"
  | "Full Moon"
  | "Waning Gibbous"
  | "Third Quarter"
  | "Waning Crescent";

export type RegistrationDifficulty = "Low" | "Medium" | "High";

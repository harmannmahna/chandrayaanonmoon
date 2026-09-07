import JSZip from "jszip";
import type {
  CraterDataset,
  IceAnalysisParams,
  IceCandidateCluster,
  IceEvidenceSummary,
  LandingCandidate,
  LandingParams,
  RoverRoute,
  RouteParams,
  VolumeScenario,
} from "./types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJson(filename: string, data: unknown) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

export function exportText(filename: string, text: string) {
  downloadBlob(new Blob([text], { type: "text/plain" }), filename);
}

export function gridToPngBlob(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
}

export function routeToGeoJSON(
  dataset: CraterDataset,
  route: RoverRoute,
  params: RouteParams,
) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          dataset: dataset.id,
          cellSizeMeters: dataset.cellSizeMeters,
          routeMode: params.mode,
          distanceMeters: route.distanceMeters,
          maxSlopeDegrees: route.maxSlopeDegrees,
          shadowFraction: route.shadowFraction,
          feasibility: route.feasibility,
          note: "Grid coordinates — illustrative planning geometry, not geodetic.",
        },
        geometry: {
          type: "LineString",
          coordinates: route.cells.map((c) => [c.x, c.y]),
        },
      },
    ],
  };
}

export function routeToCsv(route: RoverRoute): string {
  const lines = ["index,x,y"];
  route.cells.forEach((c, i) => lines.push(`${i},${c.x},${c.y}`));
  return lines.join("\n");
}

const ASSUMPTIONS_TXT = `LUNA/ICE — Assumptions and Limits
================================
This is a browser prototype using illustrative/supplied demo layers.
Ice results are radar-consistent candidate signatures (potential subsurface-ice signatures), not confirmation.
Landing/route/volume results are planning scenarios — planning support, not mission certification.
No raw DFSAR calibration, geodetic projection, ephemeris, or rover dynamics are included.
IceCandidate rule: (CPR > threshold) AND (DOP < threshold) AND DoublyShadowedMask.
Volume: V_ice = A_candidate × depth × iceFraction; M_ice = V_ice × 917 kg/m³ (assumption-based).
`;

export async function downloadMissionPackage(opts: {
  dataset: CraterDataset;
  iceParams: IceAnalysisParams;
  landingParams: LandingParams;
  routeParams: RouteParams;
  clusters: IceCandidateCluster[];
  summary: IceEvidenceSummary | null;
  selectedCluster: IceCandidateCluster | null;
  landings: LandingCandidate[];
  selectedLanding: LandingCandidate | null;
  route: RoverRoute | null;
  volumes: VolumeScenario[];
  mapPng?: Blob | null;
  candidatePng?: Blob | null;
  confidencePng?: Blob | null;
  landingPng?: Blob | null;
}) {
  const zip = new JSZip();
  zip.file("README.txt", ASSUMPTIONS_TXT);
  zip.file("assumptions_and_limits.txt", ASSUMPTIONS_TXT);
  zip.file(
    "mission_metrics.json",
    JSON.stringify(
      {
        disclaimer:
          "Browser prototype · Illustrative/supplied layers · Planning support only. Not confirmed ice / not certified landing.",
        radarThresholds: opts.iceParams,
        landingParams: opts.landingParams,
        routeParams: opts.routeParams,
        clusterMetrics: opts.clusters,
        evidenceSummary: opts.summary,
        selectedCluster: opts.selectedCluster,
        selectedLanding: opts.selectedLanding,
        routeMetrics: opts.route,
        volumeScenarios: opts.volumes,
      },
      null,
      2,
    ),
  );
  zip.file("ice_volume_scenarios.json", JSON.stringify(opts.volumes, null, 2));
  if (opts.selectedLanding) {
    zip.file("recommended_landing_site.json", JSON.stringify(opts.selectedLanding, null, 2));
  }
  if (opts.route) {
    zip.file("rover_route.geojson", JSON.stringify(routeToGeoJSON(opts.dataset, opts.route, opts.routeParams), null, 2));
    zip.file("rover_route.csv", routeToCsv(opts.route));
  }
  if (opts.mapPng) zip.file("mission_map_overlay.png", opts.mapPng);
  if (opts.candidatePng) zip.file("ice_candidate_mask.png", opts.candidatePng);
  if (opts.confidencePng) zip.file("ice_confidence_map.png", opts.confidencePng);
  if (opts.landingPng) zip.file("landing_suitability_map.png", opts.landingPng);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "lunamatch_ice_mission_package.zip");
}

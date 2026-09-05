const API = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export type DemoLoadResponse = {
  job_id: string;
  count: number;
  reference_index: number;
  preview_urls: string[];
};

export type UploadResponse = {
  job_id: string;
  count: number;
  reference_index: number;
};

export type ClaheNote = {
  note: string;
  contrast_gain: number;
  clip_limit?: number;
  tile?: number;
  edge_pixels_before?: number;
  edge_pixels_after?: number;
};

export type ClaheResponse = {
  job_id: string;
  images: string[];
  originals: string[];
  notes: ClaheNote[];
};

export type WeakRegion = {
  bbox: number[];
  match_count: number;
  mean_confidence: number;
  reason: string;
  pixel_range: string;
};

export type LoftrResponse = {
  job_id: string;
  mkpts0: number[][];
  mkpts1: number[][];
  mconf: number[];
  num_matches: number;
  mean_confidence: number;
  weak_regions: WeakRegion[];
  preview_url: string;
  matcher: string;
};

export type RansacResponse = {
  job_id: string;
  H: number[][];
  inlier_ratio: number;
  inlier_count: number;
  rmse_px: number;
  spatial_coverage: number;
  rotation_deg: number;
  scale: number;
  translation_px: number[];
  warped_url: string;
  overlay_url: string;
  tint_overlay_url: string;
  conclusion: string;
};

export type IceRegion = {
  name: string;
  confidence: string;
  bbox: number[];
  mean_cpr: number;
  mean_dop: number;
};

export type IceResponse = {
  criteria: string;
  overlay_url: string;
  optical_url: string;
  candidate_pixels: number;
  estimated_ice_volume_m3: number;
  regions: IceRegion[];
  terrain_note: string;
  relevance: string;
  landing_path_status: string;
};

export async function loadDemo() {
  return json<DemoLoadResponse>(await fetch(`${API}/demo/load`, { method: "POST" }));
}

export async function uploadImages(files: File[], referenceIndex = 0) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("reference_index", String(referenceIndex));
  return json<UploadResponse>(await fetch(`${API}/upload`, { method: "POST", body: form }));
}

export async function runClahe(jobId: string) {
  const form = new FormData();
  form.append("job_id", jobId);
  return json<ClaheResponse>(await fetch(`${API}/process/clahe`, { method: "POST", body: form }));
}

export async function runLoftr(jobId: string, sourceIndex = 1) {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("source_index", String(sourceIndex));
  return json<LoftrResponse>(await fetch(`${API}/process/loftr`, { method: "POST", body: form }));
}

export async function runRansac(jobId: string) {
  const form = new FormData();
  form.append("job_id", jobId);
  return json<RansacResponse>(await fetch(`${API}/process/ransac`, { method: "POST", body: form }));
}

export async function runIce(jobId?: string) {
  const form = new FormData();
  if (jobId) form.append("job_id", jobId);
  return json<IceResponse>(await fetch(`${API}/process/ice`, { method: "POST", body: form }));
}

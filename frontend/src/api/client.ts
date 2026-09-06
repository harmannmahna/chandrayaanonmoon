/**
 * Browser API client.
 * Always talk to same-origin `/api` (Vite proxies to the Python backend).
 * Absolute localhost fallbacks cause "Failed to fetch" when the UI is opened
 * via a tunnel / remote preview, so we deliberately avoid them.
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(
      "Failed to reach the LunaMatch API. Is the backend running on port 8000? (Python 3.11: `uvicorn main:app --host 0.0.0.0 --port 8000`)",
    );
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
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
  source_image?: string;
  used_registration_job?: boolean;
};

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await request("/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadDemo() {
  return json<DemoLoadResponse>(await request("/demo/load", { method: "POST" }));
}

export async function uploadImages(files: File[], referenceIndex = 0) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("reference_index", String(referenceIndex));
  return json<UploadResponse>(await request("/upload", { method: "POST", body: form }));
}

export async function runClahe(jobId: string) {
  const form = new FormData();
  form.append("job_id", jobId);
  return json<ClaheResponse>(await request("/process/clahe", { method: "POST", body: form }));
}

export async function runLoftr(jobId: string, sourceIndex = 1) {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("source_index", String(sourceIndex));
  return json<LoftrResponse>(await request("/process/loftr", { method: "POST", body: form }));
}

export async function runRansac(jobId: string) {
  const form = new FormData();
  form.append("job_id", jobId);
  return json<RansacResponse>(await request("/process/ransac", { method: "POST", body: form }));
}

export async function runIce(jobId?: string) {
  const form = new FormData();
  if (jobId) form.append("job_id", jobId);
  return json<IceResponse>(await request("/process/ice", { method: "POST", body: form }));
}

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
    try {
      const data = JSON.parse(text) as { detail?: unknown };
      if (data?.detail != null) {
        const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        if (/unknown job/i.test(detail)) {
          throw new Error(
            "Session expired or the API restarted. Please upload images or click Load demo pair again.",
          );
        }
        throw new Error(detail);
      }
    } catch (err) {
      if (err instanceof Error && err.message && err.message !== text) throw err;
    }
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
  unmatched0?: number[][];
  unmatched1?: number[][];
  /** Keypoints detected on both views before match/unmatch split. */
  total_keypoints_evaluated?: number;
  num_matches: number;
  num_unmatched?: number;
  /** Average confidence of matched (green) keypoints only — never includes red/unmatched. */
  mean_confidence: number;
  matched_mean_confidence?: number;
  weak_regions: WeakRegion[];
  preview_url: string;
  unmatched_preview_url?: string;
  matcher: string;
  engine?: string;
  requested_engine?: string;
  fallback_used?: boolean;
  fallback_reason?: string;
  runtime_ms?: number;
  status?: string;
  illumination_delta?: number;
  blur_proxy_ref?: number;
  blur_proxy_src?: number;
};

export type ReliabilityResult = {
  score: number;
  trust_label: string;
  reasons: string[];
  limitation: string;
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
  reliability?: ReliabilityResult;
  engine?: string;
  matcher?: string;
  fallback_used?: boolean;
  runtime_ms_match?: number;
  raw_match_count?: number;
};

export type MatcherEngineInfo = {
  engine: "akaze" | "superpoint-lightglue" | "loftr";
  label: string;
  ui_label: string;
  description: string;
  available: boolean;
  status: string;
  detail?: string;
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

export async function runLoftr(
  jobId: string,
  sourceIndex = 1,
  engine: "akaze" | "superpoint-lightglue" | "loftr" = "akaze",
  allowFallback = true,
) {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("source_index", String(sourceIndex));
  form.append("engine", engine);
  form.append("allow_fallback", String(allowFallback));
  return json<LoftrResponse>(await request("/process/loftr", { method: "POST", body: form }));
}

export async function runRansac(jobId: string) {
  const form = new FormData();
  form.append("job_id", jobId);
  return json<RansacResponse>(await request("/process/ransac", { method: "POST", body: form }));
}

export async function listMatchers() {
  return json<{ engines: MatcherEngineInfo[] }>(await request("/matchers"));
}

export async function runMatch(opts: {
  jobId?: string;
  engine?: "akaze" | "superpoint-lightglue" | "loftr";
  sourceIndex?: number;
  allowFallback?: boolean;
}) {
  const form = new FormData();
  if (opts.jobId) form.append("job_id", opts.jobId);
  form.append("engine", opts.engine ?? "akaze");
  form.append("source_index", String(opts.sourceIndex ?? 1));
  form.append("allow_fallback", String(opts.allowFallback ?? true));
  return json<LoftrResponse & { engine_catalog?: MatcherEngineInfo[] }>(
    await request("/match", { method: "POST", body: form }),
  );
}

export async function runIce(jobId?: string) {
  const form = new FormData();
  if (jobId) form.append("job_id", jobId);
  return json<IceResponse>(await request("/process/ice", { method: "POST", body: form }));
}

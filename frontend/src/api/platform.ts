/**
 * Typed client for LunaMatch platform APIs (/api/v1).
 * Uses same-origin `/api` (Vite proxy / nginx / StripApiPrefixMiddleware).
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    return await fetch(url, init);
  } catch {
    throw new Error("Failed to reach LunaMatch platform API");
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { detail?: unknown };
      if (data?.detail != null) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
      }
    } catch (err) {
      if (err instanceof Error && err.message && err.message !== text) throw err;
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type Project = {
  id: string;
  name: string;
  description: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Dataset = {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  content_type: string;
  byte_size: number;
  object_key: string;
  data_status: string;
  meta: Record<string, unknown>;
  created_at: string;
  download_url?: string | null;
};

export type AnalysisRun = {
  id: string;
  project_id: string;
  kind: string;
  status: string;
  progress: number;
  message: string;
  engine: string;
  params: Record<string, unknown>;
  lineage: Record<string, unknown>;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationResult = {
  id: string;
  run_id: string;
  engine: string;
  engine_version: string;
  device: string;
  fallback_used: boolean;
  runtime_ms?: number | null;
  metrics: Record<string, unknown>;
  reliability: Record<string, unknown>;
  object_keys: Record<string, string>;
  limitations: string;
  download_urls: Record<string, string>;
};

export type ExportJob = {
  id: string;
  run_id: string;
  status: string;
  object_key?: string | null;
  byte_size: number;
  download_url?: string | null;
  error?: string | null;
  created_at: string;
};

export type PlatformHealth = {
  status: string;
  service: string;
  database: string;
  redis: string;
  minio: string;
  matchers: Array<{ engine: string; available: boolean; status: string }>;
};

export async function platformHealth(): Promise<PlatformHealth | null> {
  try {
    const res = await request("/v1/health");
    if (!res.ok) return null;
    return (await res.json()) as PlatformHealth;
  } catch {
    return null;
  }
}

export async function listProjects() {
  return json<Project[]>(await request("/v1/projects"));
}

export async function createProject(name: string, description = "") {
  return json<Project>(
    await request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function listDatasets(projectId: string) {
  return json<Dataset[]>(await request(`/v1/datasets/project/${projectId}`));
}

export async function uploadDatasetFile(
  projectId: string,
  file: File,
  opts?: { kind?: string; dataStatus?: string },
) {
  const init = await json<{
    dataset_id: string;
    upload_url: string;
    headers: Record<string, string>;
  }>(
    await request("/v1/datasets/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        byte_size: file.size,
        kind: opts?.kind ?? "optical",
        data_status: opts?.dataStatus ?? "real uploaded image",
      }),
    }),
  );

  const put = await fetch(init.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream", ...(init.headers || {}) },
    body: file,
  });
  if (!put.ok) throw new Error(`MinIO upload failed (${put.status})`);

  return json<Dataset>(
    await request("/v1/datasets/uploads/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: init.dataset_id }),
    }),
  );
}

export async function startRegistrationRun(body: {
  project_id: string;
  reference_dataset_id: string;
  source_dataset_id: string;
  engine?: string;
  allow_fallback?: boolean;
}) {
  return json<AnalysisRun>(
    await request("/v1/registration/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "akaze",
        allow_fallback: true,
        ...body,
      }),
    }),
  );
}

export async function getRegistrationRun(runId: string) {
  return json<AnalysisRun>(await request(`/v1/registration/runs/${runId}`));
}

export async function getRegistrationResults(runId: string) {
  return json<RegistrationResult>(await request(`/v1/registration/runs/${runId}/results`));
}

export async function cancelRegistrationRun(runId: string) {
  return json<AnalysisRun>(await request(`/v1/registration/runs/${runId}/cancel`, { method: "POST" }));
}

export async function listRegistrationRuns(projectId: string) {
  return json<AnalysisRun[]>(await request(`/v1/registration/projects/${projectId}/runs`));
}

export async function createExport(runId: string) {
  return json<ExportJob>(
    await request("/v1/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
    }),
  );
}

export async function getExport(exportId: string) {
  return json<ExportJob>(await request(`/v1/exports/${exportId}`));
}

export async function persistIceAnalysis(body: Record<string, unknown>) {
  return json<AnalysisRun>(
    await request("/v1/ice/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function pollUntil<T>(
  fn: () => Promise<T>,
  done: (value: T) => boolean,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<T> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const value = await fn();
        if (done(value)) {
          resolve(value);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for job"));
          return;
        }
        window.setTimeout(() => void tick(), intervalMs);
      } catch (err) {
        reject(err);
      }
    };
    void tick();
  });
}

import { useEffect, useState } from "react";
import {
  createProject,
  listProjects,
  listRegistrationRuns,
  platformHealth,
  type AnalysisRun,
  type PlatformHealth,
  type Project,
} from "../../api/platform";
import { useAppStore } from "../../store/appStore";

const STAGES = ["queued", "preprocessing", "matching", "ransac", "refinement", "exporting", "completed", "failed"] as const;

export function PlatformProjectBar({
  serverRun,
}: {
  serverRun?: AnalysisRun | null;
}) {
  const mode = useAppStore((s) => s.workspaceMode);
  const setMode = useAppStore((s) => s.setWorkspaceMode);
  const projectId = useAppStore((s) => s.projectId);
  const setProjectId = useAppStore((s) => s.setProjectId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [name, setName] = useState("SIH demo project");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void platformHealth().then((h) => {
      if (!cancelled) setHealth(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "platform" || !health || health.database !== "ok") return;
    let cancelled = false;
    void listProjects()
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows);
        if (!projectId && rows[0]) setProjectId(rows[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to list projects"));
    return () => {
      cancelled = true;
    };
  }, [mode, health, projectId, setProjectId]);

  useEffect(() => {
    if (mode !== "platform" || !projectId) return;
    let cancelled = false;
    void listRegistrationRuns(projectId)
      .then((rows) => {
        if (!cancelled) setRuns(rows.slice(0, 8));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, projectId, serverRun?.id, serverRun?.status]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await createProject(name.trim() || "Untitled project");
      setProjects((prev) => [p, ...prev]);
      setProjectId(p.id);
      setMode("platform");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create project failed");
    } finally {
      setBusy(false);
    }
  };

  const platformReady = Boolean(health && health.database === "ok" && health.minio === "ok");

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="kicker">Workspace mode</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn !min-h-8 text-xs ${mode === "local" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("local")}
          >
            Local demo mode
          </button>
          <button
            type="button"
            className={`btn !min-h-8 text-xs ${mode === "platform" ? "btn-primary" : "btn-secondary"}`}
            disabled={!platformReady}
            onClick={() => setMode("platform")}
            title={platformReady ? "Use Postgres/MinIO/Celery platform" : "Platform DB/MinIO unavailable"}
          >
            Platform mode
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-5 text-[var(--muted)]">
        Local demo keeps the existing browser→FastAPI disk pipeline. Platform mode stores projects/datasets/runs in
        Postgres + MinIO and processes jobs via Celery.
        {!platformReady ? " Platform services not detected — local demo remains available." : null}
      </p>
      {mode === "platform" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-xl border border-[var(--border)] bg-black/30 px-3 py-2 text-sm"
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-xl border border-[var(--border)] bg-black/30 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project name"
            />
            <button type="button" className="btn btn-secondary !min-h-8 text-xs" disabled={busy} onClick={() => void create()}>
              Create project
            </button>
          </div>
          {serverRun ? (
            <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
              <p className="font-medium text-[var(--text)]">
                Server run {serverRun.status} · {(serverRun.progress * 100).toFixed(0)}%
              </p>
              <p className="text-[var(--muted)]">{serverRun.message}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {STAGES.map((s) => (
                  <span
                    key={s}
                    className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                      serverRun.status === s
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {runs.length ? (
            <div className="text-[11px] text-[var(--muted)]">
              <p className="kicker mb-1">Server run history</p>
              <ul className="space-y-1">
                {runs.map((r) => (
                  <li key={r.id}>
                    {r.engine} · {r.status} · {new Date(r.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

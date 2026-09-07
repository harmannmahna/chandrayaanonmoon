import { useState } from "react";
import { persistIceAnalysis } from "../../api/platform";
import { useAppStore } from "../../store/appStore";

/** Optional platform persistence for ice planner results (no-op outside platform mode). */
export function IcePlatformPersist(props: {
  thresholds: Record<string, unknown>;
  clusterMetrics: Record<string, unknown>;
  volumeScenarios: Record<string, unknown>;
  landingCandidates: Array<Record<string, unknown>>;
  roverRoutes: Array<Record<string, unknown>>;
}) {
  const mode = useAppStore((s) => s.workspaceMode);
  const projectId = useAppStore((s) => s.projectId);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (mode !== "platform" || !projectId) {
    return (
      <p className="text-[10px] leading-5 text-[var(--muted)]">
        Platform persistence available when Workspace mode = Platform and a project is selected on Register.
      </p>
    );
  }

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const run = await persistIceAnalysis({
        project_id: projectId,
        thresholds: props.thresholds,
        cluster_metrics: props.clusterMetrics,
        volume_scenarios: props.volumeScenarios,
        landing_candidates: props.landingCandidates,
        rover_routes: props.roverRoutes,
        meta: {
          disclaimer:
            "Illustrative / prototype ice planner output — potential signatures only, not confirmed ice.",
        },
      });
      setMsg(`Saved ice run ${run.id.slice(0, 8)}… (prototype disclaimer stored)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Persist failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-secondary w-full text-xs" disabled={busy} onClick={() => void save()}>
        Persist ice analysis to platform
      </button>
      {msg ? <p className="text-[10px] text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}

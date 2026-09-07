import type { RunRecord } from "./types";

const KEY = "lunamatch.experimentRuns.v1";
const MAX = 20;

export function loadRuns(): RunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RunRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): RunRecord[] {
  const prev = loadRuns().filter((r) => r.id !== run.id);
  const next = [run, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearRuns(): void {
  localStorage.removeItem(KEY);
}

export function exportRunJson(run: RunRecord): void {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lunamatch_run_${run.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAllRunsJson(runs: RunRecord[]): void {
  const blob = new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lunamatch_experiment_history.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function newRunId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

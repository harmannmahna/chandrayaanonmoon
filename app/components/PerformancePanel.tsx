export function PerformancePanel() {
  return (
    <section className="panel p-5">
      <div className="kicker">Performance & scalability</div>
      <h2 className="mt-2 text-2xl font-medium tracking-tight text-[var(--text-primary)]">Current limits and future scale</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="panel-muted p-4">
          <div className="kicker !text-[9px] opacity-70">Max tested size</div>
          <div className="mt-2 text-xl text-[var(--text-primary)]">2000×2000</div>
          <p className="muted mt-2 text-sm">Larger rasters are accepted but should be downsampled for preview.</p>
        </div>
        <div className="panel-muted p-4">
          <div className="kicker !text-[9px] opacity-70">Runtime / pair</div>
          <div className="mt-2 text-xl text-[var(--text-primary)]">~2–8 s</div>
          <p className="muted mt-2 text-sm">Typical laptop browser for demo-resolution triplets.</p>
        </div>
        <div className="panel-muted p-4">
          <div className="kicker !text-[9px] opacity-70">Execution</div>
          <div className="mt-2 text-xl text-[var(--text-primary)]">In-browser</div>
          <p className="muted mt-2 text-sm">No backend yet. Matching can later move to a GPU service.</p>
        </div>
      </div>
    </section>
  );
}

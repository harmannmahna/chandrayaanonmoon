export function PerformancePanel() {
  return (
    <section className="border border-[#292927] bg-[#0d0d0d] p-5">
      <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Performance & scalability</div>
      <h2 className="mt-2 text-2xl font-medium tracking-tight text-white">Current limits and future scale</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="border border-[#292927] bg-[#101010] p-4">
          <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Max tested size</div>
          <div className="mt-2 text-xl text-white">2000×2000</div>
          <p className="mt-2 text-sm text-[#8a8a86]">Larger rasters are accepted but should be downsampled for preview.</p>
        </div>
        <div className="border border-[#292927] bg-[#101010] p-4">
          <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Runtime / pair</div>
          <div className="mt-2 text-xl text-white">~2–8 s</div>
          <p className="mt-2 text-sm text-[#8a8a86]">Typical laptop browser for demo-resolution triplets.</p>
        </div>
        <div className="border border-[#292927] bg-[#101010] p-4">
          <div className="mono text-[9px] uppercase tracking-[0.12em] text-[#666]">Execution</div>
          <div className="mt-2 text-xl text-white">In-browser</div>
          <p className="mt-2 text-sm text-[#8a8a86]">No backend yet. Matching can later move to a GPU service.</p>
        </div>
      </div>
    </section>
  );
}

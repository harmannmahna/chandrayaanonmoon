import { PerformancePanel } from "@/app/components/PerformancePanel";
import { SensorCard } from "@/app/components/SensorCard";
import { SENSOR_CONTEXT } from "@/app/lib/types";

const PRODUCTS = [
  { file: "registered_source.png", meaning: "Source image warped into the reference frame" },
  { file: "reference_image.png", meaning: "Reference product used as the common coordinate system" },
  { file: "match_points.csv", meaning: "Correspondence list with confidence scores" },
  { file: "homography.json", meaning: "3×3 transform mapping source pixels to reference pixels" },
  { file: "metrics.json", meaning: "RMSE, inliers, coverage, confidence, and quality labels" },
  { file: "overlay_proof.png", meaning: "50/50 blend used as a visual registration check" },
];

export default function ContextPage() {
  return (
    <div className="space-y-8">
      <section className="border border-[#292927] bg-[#0d0d0d] p-6">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">One-line pitch</div>
        <p className="mt-3 max-w-4xl text-lg leading-8 text-[#e7e7e3]">
          We take three multi-modal lunar images, normalize them, enhance them with CLAHE, find correspondences for every pair, reject outliers with RANSAC, warp them into a common frame, and export registered products, match points, and homographies — with metrics and coverage proving the alignment.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#888]">Context & product spec</div>
          <h1 className="mt-2 text-4xl font-medium tracking-tight text-white">Why registration matters for Chandrayaan-2</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#9a9a96]">
            Chandrayaan-2 and LRO observe the same lunar surface with different sensors, resolutions, and lighting geometry. Before morphology, mineralogy, or hazard layers can be compared, those images must share a common pixel frame. LUNA/REGISTER is a prototype pipeline for that alignment step. It is not an official ISRO product.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SensorCard sensor={{ ...SENSOR_CONTEXT.OHRC, notes: SENSOR_CONTEXT.OHRC.summary }} slot="OHRC" />
          <SensorCard sensor={{ ...SENSOR_CONTEXT.TMC2, notes: SENSOR_CONTEXT.TMC2.summary }} slot="TMC-2" />
          <SensorCard sensor={{ ...SENSOR_CONTEXT.IIRS, notes: SENSOR_CONTEXT.IIRS.summary }} slot="IIRS" />
          <SensorCard sensor={{ ...SENSOR_CONTEXT.LRO_NAC, notes: SENSOR_CONTEXT.LRO_NAC.summary }} slot="LRO NAC" />
        </div>
      </section>

      <section className="border border-[#292927] bg-[#0d0d0d] p-5">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Operational workflow</div>
        <h2 className="mt-2 text-2xl font-medium text-white">Example use case</h2>
        <p className="mt-3 text-sm leading-7 text-[#9a9a96]">A lunar scientist has:</p>
        <ul className="mt-2 space-y-2 text-sm leading-7 text-[#9a9a96]">
          <li>An OHRC-like strip over a candidate landing site.</li>
          <li>An LRO reference mosaic of the same region.</li>
        </ul>
        <p className="mt-4 text-sm leading-7 text-[#9a9a96]">They use LUNA/REGISTER to:</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-7 text-[#9a9a96]">
          <li>Upload OHRC-like (A) and LRO-like (B).</li>
          <li>Run registration.</li>
          <li>Inspect overlay and quality badge.</li>
          <li>
            Export:
            <span className="mt-1 block space-x-2">
              <code className="text-[#d8ff3e]">registered_OHRC.png</code>
              <code className="text-[#d8ff3e]">match_points.csv</code>
              <code className="text-[#d8ff3e]">metrics.json</code>
            </span>
          </li>
        </ol>
        <p className="mt-4 text-sm leading-7 text-[#9a9a96]">They then:</p>
        <ul className="mt-2 space-y-2 text-sm leading-7 text-[#9a9a96]">
          <li>Import <code className="text-[#d8ff3e]">registered_OHRC.png</code> into their GIS.</li>
          <li>Use <code className="text-[#d8ff3e]">match_points.csv</code> as tie points for further bundle adjustment.</li>
          <li>Combine with IIRS-like mineral maps to relate morphology and composition.</li>
        </ul>
      </section>

      <section className="border border-[#292927] bg-[#101010] p-5">
        <h2 className="text-2xl font-medium text-white">How registration helps</h2>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-[#9a9a96]">
          <li>Combine high-resolution morphology (OHRC / TMC-2) with mineralogical context (IIRS).</li>
          <li>Support landing-site characterization and hazard mapping against trusted LRO references.</li>
          <li>Enable multi-temporal and multi-sensor change analysis once products share one coordinate system.</li>
        </ul>
      </section>

      <section className="border border-[#292927] bg-[#0d0d0d] p-5">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Registered product package</div>
        <h2 className="mt-2 text-2xl font-medium text-white">What a scientist can take away</h2>
        <div className="mt-4 overflow-hidden border border-[#292927]">
          <div className="grid grid-cols-[220px_1fr] border-b border-[#292927] bg-[#151515] px-4 py-3 mono text-[10px] uppercase tracking-[0.12em] text-[#777]">
            <span>File</span>
            <span>Meaning</span>
          </div>
          {PRODUCTS.map((item) => (
            <div key={item.file} className="grid grid-cols-[220px_1fr] border-b border-[#292927] px-4 py-3 text-sm last:border-b-0">
              <code className="text-[#d8ff3e]">{item.file}</code>
              <span className="text-[#9a9a96]">{item.meaning}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-[#292927] bg-[#101010] p-5">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">Engineering extensions</div>
        <h2 className="mt-2 text-2xl font-medium text-white">Real mission data</h2>
        <p className="mt-3 text-sm leading-7 text-[#9a9a96]">For real Chandrayaan-2 / LRO usage, the pipeline would:</p>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#9a9a96]">
          <li>Accept calibrated PDS products (e.g. <code className="text-[#d8ff3e]">.IMG</code> + label) via a server-side reader.</li>
          <li>
            Use spacecraft ephemeris and DTM/DEM data for:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Better initial coarse alignment.</li>
              <li>Physically motivated projection models beyond a single homography.</li>
            </ul>
          </li>
          <li>Run matching and RANSAC on tiles for large rasters.</li>
          <li>Validate against ground control points or high-accuracy reference maps.</li>
        </ul>
        <p className="mt-4 text-sm leading-7 text-[#9a9a96]">
          This prototype demonstrates the core correspondence + registration logic; the data ingestion and geodesy layers are engineering extensions, not conceptual changes.
        </p>
      </section>

      <PerformancePanel />
    </div>
  );
}

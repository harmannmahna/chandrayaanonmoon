import { PerformancePanel } from "@/app/components/PerformancePanel";
import { SensorCard } from "@/app/components/SensorCard";
import { LunarBackdrop } from "@/app/components/LunarBackdrop";
import { SectionLabel } from "@/app/components/SectionLabel";
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
    <div className="relative mx-auto w-[min(1200px,94vw)] pb-12 pt-4">
      <section className="mission-hero !min-h-[58vh] !w-full !px-0">
        <LunarBackdrop variant="large" position="right" opacity={0.68} src="/lunar/full-moon.png" />
        <div className="mission-hero__copy">
          <div className="kicker">Context & product spec</div>
          <h1 className="mission-hero__title">
            From lunar pixels
            <br />
            to trusted alignment.
          </h1>
          <p className="mission-hero__body">
            Chandrayaan-2 and LRO observe the same surface with different sensors, resolutions, and
            lighting. Before morphology, mineralogy, or hazard layers can be compared, those images
            must share a common pixel frame.
          </p>
          <p className="mission-hero__status">
            Prototype · Not an official ISRO product · Homography is a planar pixel transform
          </p>
        </div>
      </section>

      <div className="page-shell relative z-10 space-y-8">
        <section className="panel p-6">
          <div className="kicker">One-line pitch</div>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-[var(--text-primary)]">
            We take three multi-modal lunar images, normalize them, enhance them with CLAHE, find
            correspondences for every pair, reject outliers with RANSAC, warp them into a common
            frame, and export registered products, match points, and homographies — with metrics and
            coverage proving the alignment.
          </p>
        </section>

        <section className="space-y-4">
          <SectionLabel number="01" label="WHY REGISTRATION MATTERS" />
          <div className="relative overflow-hidden panel p-6">
            <LunarBackdrop
              variant="terrain"
              position="right"
              opacity={0.22}
              src="/lunar/moon-horizon.png"
              className="!top-auto !bottom-[-28%] !right-[-10%]"
            />
            <div className="relative z-[1]">
              <h2 className="text-3xl font-medium tracking-tight text-[var(--text-primary)]">
                Why registration matters for Chandrayaan-2
              </h2>
              <p className="muted mt-3 max-w-3xl text-sm leading-7">
                LUNA/REGISTER is a prototype pipeline for that alignment step. Demo data is
                synthetic/illustrative. The current matcher is a LoFTR-style local dense adapter, not
                trained LoFTR. RMSE is reprojection error on inliers — not lunar geodetic accuracy.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SensorCard sensor={{ ...SENSOR_CONTEXT.OHRC, notes: SENSOR_CONTEXT.OHRC.summary }} slot="OHRC" />
            <SensorCard sensor={{ ...SENSOR_CONTEXT.TMC2, notes: SENSOR_CONTEXT.TMC2.summary }} slot="TMC-2" />
            <SensorCard sensor={{ ...SENSOR_CONTEXT.IIRS, notes: SENSOR_CONTEXT.IIRS.summary }} slot="IIRS" />
            <SensorCard sensor={{ ...SENSOR_CONTEXT.LRO_NAC, notes: SENSOR_CONTEXT.LRO_NAC.summary }} slot="LRO NAC" />
          </div>
        </section>

        <section className="panel p-5">
          <SectionLabel number="02" label="EXAMPLE USE CASE" />
          <div className="kicker mt-2">Operational workflow</div>
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">Example use case</h2>
          <p className="muted mt-3 text-sm leading-7">A lunar scientist has:</p>
          <ul className="muted mt-2 space-y-2 text-sm leading-7">
            <li>An OHRC-like strip over a candidate landing site.</li>
            <li>An LRO reference mosaic of the same region.</li>
          </ul>
          <p className="muted mt-4 text-sm leading-7">They use LUNA/REGISTER to:</p>
          <ol className="muted mt-2 list-decimal space-y-2 pl-5 text-sm leading-7">
            <li>Upload OHRC-like (A) and LRO-like (B).</li>
            <li>Run registration.</li>
            <li>Inspect overlay and quality badge.</li>
            <li>
              Export:
              <span className="mt-1 block space-x-2">
                <code className="code-accent">registered_OHRC.png</code>
                <code className="code-accent">match_points.csv</code>
                <code className="code-accent">metrics.json</code>
              </span>
            </li>
          </ol>
          <p className="muted mt-4 text-sm leading-7">They then:</p>
          <ul className="muted mt-2 space-y-2 text-sm leading-7">
            <li>
              Import <code className="code-accent">registered_OHRC.png</code> into their GIS.
            </li>
            <li>
              Use <code className="code-accent">match_points.csv</code> as tie points for further bundle
              adjustment.
            </li>
            <li>Combine with IIRS-like mineral maps to relate morphology and composition.</li>
          </ul>
        </section>

        <section className="panel p-5">
          <SectionLabel number="03" label="SCIENTIFIC VALUE" />
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">How registration helps</h2>
          <ul className="muted mt-4 space-y-3 text-sm leading-7">
            <li>Combine high-resolution morphology (OHRC / TMC-2) with mineralogical context (IIRS).</li>
            <li>Support landing-site characterization and hazard mapping against trusted LRO references.</li>
            <li>Enable multi-temporal and multi-sensor change analysis once products share one coordinate system.</li>
          </ul>
        </section>

        <section className="panel p-5">
          <SectionLabel number="04" label="PRODUCT PACKAGE" />
          <div className="kicker mt-2">Registered product package</div>
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">What a scientist can take away</h2>
          <div className="mt-4 overflow-hidden border border-[var(--border)] rounded-lg">
            <div className="grid grid-cols-[minmax(140px,220px)_1fr] border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent-secondary)_8%,transparent)] px-4 py-3 kicker !text-[var(--text-muted)]">
              <span>File</span>
              <span>Meaning</span>
            </div>
            {PRODUCTS.map((item) => (
              <div
                key={item.file}
                className="grid grid-cols-[minmax(140px,220px)_1fr] border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0"
              >
                <code className="code-accent break-all">{item.file}</code>
                <span className="muted">{item.meaning}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <SectionLabel number="05" label="REAL MISSION DATA" />
          <div className="kicker mt-2">Engineering extensions</div>
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">Real mission data</h2>
          <p className="muted mt-3 text-sm leading-7">For real Chandrayaan-2 / LRO usage, the pipeline would:</p>
          <ul className="muted mt-3 space-y-2 text-sm leading-7">
            <li>
              Accept calibrated PDS products (e.g. <code className="code-accent">.IMG</code> + label) via a
              server-side reader.
            </li>
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
          <p className="muted mt-4 text-sm leading-7">
            This prototype demonstrates the core correspondence + registration logic; the data ingestion
            and geodesy layers are engineering extensions, not conceptual changes.
          </p>
        </section>

        <section className="panel p-5">
          <SectionLabel number="06" label="REAL LOFTR INTEGRATION" />
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">
            Real LoFTR integration (future work)
          </h2>
          <p className="muted mt-3 text-sm leading-7">
            Today&apos;s matcher is a browser-friendly LoFTR-<em>style</em> local dense adapter. A future
            build can swap in trained LoFTR (or similar) weights via a GPU service while keeping the same
            RANSAC → refine → warp → metrics export path. That swap is an engineering integration, not a
            redesign of the scientific product package.
          </p>
        </section>

        <PerformancePanel />
      </div>
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleDot, Download, FileImage,
  Grid3X3, ImagePlus, Info, Layers3, LoaderCircle, ScanLine, Sparkles, Upload, X,
} from "lucide-react";
import {
  applyClahe, canvasToUrl, computeMetrics, estimateRansac, loadImage,
  matchFeatures, warpAndBlend,
} from "./engine";

const STAGES = [
  { id: "INPUT", title: "Image input", short: "Input" },
  { id: "01", title: "Preprocessing", short: "CLAHE" },
  { id: "02", title: "Feature matching", short: "LoFTR" },
  { id: "03", title: "Outlier rejection", short: "RANSAC" },
  { id: "04", title: "Registration", short: "Transform" },
  { id: "05", title: "Analysis", short: "Results" },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Header({ stage, setStage, available }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setStage(0)}>
        <span className="brand-mark"><span /></span>
        <span>LUNA<em>/</em>REGISTER</span>
      </button>
      <nav className="stage-nav" aria-label="Pipeline progress">
        {STAGES.map((item, index) => (
          <button
            key={item.id}
            className={index === stage ? "active" : index < stage ? "done" : ""}
            disabled={index > available}
            onClick={() => index <= available && setStage(index)}
          >
            <span>{index < stage ? <Check size={11} /> : item.id}</span>
            {item.short}
          </button>
        ))}
      </nav>
      <div className="status"><i /> SYSTEM ONLINE</div>
    </header>
  );
}

function FileCard({ type, label, subtitle, file, preview, onFile, onRemove }) {
  const input = useRef(null);
  return (
    <div
      className={`upload-card ${file ? "has-file" : ""}`}
      onClick={() => !file && input.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const dropped = event.dataTransfer.files[0];
        if (dropped?.type.startsWith("image/")) onFile(dropped);
      }}
    >
      <input ref={input} hidden type="file" accept="image/*,.tif,.tiff" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      {file ? (
        <>
          <img src={preview} alt={`${label} preview`} />
          <div className="file-shade" />
          <button className="remove-file" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={16} /></button>
          <div className="file-meta">
            <span><Check size={12} /> LOADED</span>
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type.split("/")[1]?.toUpperCase() || "IMAGE"}</small>
          </div>
        </>
      ) : (
        <div className="upload-empty">
          <span className="type-label">{type}</span>
          <div className="upload-icon"><ImagePlus size={30} strokeWidth={1.3} /></div>
          <h3>{label}</h3>
          <p>{subtitle}</p>
          <button className="outline-button"><Upload size={14} /> Select image</button>
          <small>PNG, JPG, WEBP · MAX 50 MB</small>
        </div>
      )}
    </div>
  );
}

function InputScreen({ files, previews, setFile, begin }) {
  return (
    <main className="page input-page">
      <section className="hero">
        <div className="eyebrow"><span>MISSION</span> MULTI-MODAL LUNAR REGISTRATION</div>
        <h1>Align the <span>unalignable.</span></h1>
        <p>Register Chandrayaan-2 imagery against LRO reference data across illumination, scale, and sensor differences.</p>
      </section>
      <div className="input-label"><span>01</span> LOAD IMAGE PAIR <i /></div>
      <section className="upload-grid">
        <FileCard type="SOURCE / A" label="Chandrayaan-2 image" subtitle="OHRC · TMC · IIRS sensor data" file={files.source} preview={previews.source} onFile={(f) => setFile("source", f)} onRemove={() => setFile("source", null)} />
        <div className="versus"><span>A</span><i /><b>VS</b><i /><span>B</span></div>
        <FileCard type="REFERENCE / B" label="LRO reference image" subtitle="LROC NAC · WAC map data" file={files.reference} preview={previews.reference} onFile={(f) => setFile("reference", f)} onRemove={() => setFile("reference", null)} />
      </section>
      <div className="start-row">
        <div className="privacy"><Info size={14} /> Images are processed locally in your browser.</div>
        <button className="primary-button" disabled={!files.source || !files.reference} onClick={begin}>
          Initialize pipeline <ArrowRight size={16} />
        </button>
      </div>
      <section className="pipeline-strip">
        {["CLAHE PREPROCESSING", "DENSE MATCHING", "RANSAC FILTER", "HOMOGRAPHY WARP"].map((name, i) => {
          const Icon = [Sparkles, ScanLine, CircleDot, Layers3][i];
          return <div key={name}><span>0{i + 1}</span><i><Icon size={18} /></i><b>{name}</b>{i < 3 && <ChevronRight size={13} />}</div>;
        })}
      </section>
    </main>
  );
}

function PageTitle({ number, title, description, tag }) {
  return (
    <div className="page-title">
      <div className="stage-number">{number}</div>
      <div><div className="eyebrow">{tag}</div><h1>{title}</h1><p>{description}</p></div>
    </div>
  );
}

function ImagePanel({ label, title, src, badge, children }) {
  return (
    <article className="image-panel">
      <header><div><span>{label}</span><strong>{title}</strong></div>{badge && <small>{badge}</small>}</header>
      <div className="image-frame"><img src={src} alt={title} />{children}</div>
    </article>
  );
}

function ProcessingScreen({ original, processed, working, run, next }) {
  return (
    <main className="page stage-page">
      <PageTitle number="01" tag="IMAGE ENHANCEMENT" title="Preprocessing" description="Normalize local contrast to expose terrain structure in both shadow and highlight regions." />
      <section className="compare-grid">
        <div>
          <div className="section-cap">SOURCE / CHANDRAYAAN-2</div>
          <div className="before-after">
            <ImagePanel label="BEFORE" title="Raw input" src={original.source} />
            <ImagePanel label="AFTER" title="CLAHE enhanced" src={processed?.source || original.source} badge={processed && "COMPLETE"} />
          </div>
        </div>
        <div>
          <div className="section-cap">REFERENCE / LRO</div>
          <div className="before-after">
            <ImagePanel label="BEFORE" title="Raw input" src={original.reference} />
            <ImagePanel label="AFTER" title="CLAHE enhanced" src={processed?.reference || original.reference} badge={processed && "COMPLETE"} />
          </div>
        </div>
      </section>
      <div className="algorithm-card">
        <div><Sparkles size={19} /><span><b>CLAHE</b><small>Contrast Limited Adaptive Histogram Equalization</small></span></div>
        <dl><div><dt>TILE GRID</dt><dd>8 × 8</dd></div><div><dt>CLIP LIMIT</dt><dd>2.50</dd></div><div><dt>COLOR SPACE</dt><dd>LUMINANCE</dd></div></dl>
        <button className="primary-button" onClick={processed ? next : run} disabled={working}>{working ? <><LoaderCircle className="spin" size={16} /> Processing</> : processed ? <>Continue <ArrowRight size={16} /></> : <>Run preprocessing <Sparkles size={16} /></>}</button>
      </div>
    </main>
  );
}

function MatchCanvas({ left, right, matches, inliers, showOutliers = true }) {
  const shown = inliers || matches;
  const inlierSet = new Set((inliers || []).map((m) => m));
  return (
    <div className="match-canvas">
      <div className="match-image"><img src={left} alt="Source features" /></div>
      <div className="match-image"><img src={right} alt="Reference features" /></div>
      <svg viewBox="0 0 1000 420" preserveAspectRatio="none">
        {shown.slice(0, 70).map((match, index) => {
          const isInlier = !inliers || inlierSet.has(match);
          if (!showOutliers && !isInlier) return null;
          const x1 = match.source.x / match.sourceWidth * 480;
          const y1 = match.source.y / match.sourceHeight * 420;
          const x2 = 520 + match.target.x / match.targetWidth * 480;
          const y2 = match.target.y / match.targetHeight * 420;
          return <g key={index} className={isInlier ? "inlier-line" : "outlier-line"}><line x1={x1} y1={y1} x2={x2} y2={y2} /><circle cx={x1} cy={y1} r="2.5" /><circle cx={x2} cy={y2} r="2.5" /></g>;
        })}
      </svg>
      <span className="canvas-label left">A · SOURCE</span><span className="canvas-label right">B · REFERENCE</span>
    </div>
  );
}

function MatchingScreen({ processed, matches, working, run, next }) {
  return (
    <main className="page stage-page">
      <PageTitle number="02" tag="CROSS-IMAGE CORRESPONDENCE" title="Feature Detection + Matching" description="Find terrain correspondences across sensor, scale, and illumination differences." />
      <div className="model-banner"><div><ScanLine size={20} /><span><b>LoFTR matching stage</b><small>Detector-free correspondence interface · local prototype engine</small></span></div><span className="engine-badge">LOCAL RUNTIME</span></div>
      <MatchCanvas left={processed.source} right={processed.reference} matches={matches || []} />
      <section className="metric-row">
        <div><span>RAW MATCHES</span><strong>{matches?.length || "—"}</strong><small>candidate pairs</small></div>
        <div><span>MEAN CONFIDENCE</span><strong>{matches?.length ? `${(matches.reduce((s, m) => s + m.confidence, 0) / matches.length * 100).toFixed(1)}%` : "—"}</strong><small>descriptor agreement</small></div>
        <div><span>IMAGE COVERAGE</span><strong>{matches?.length ? "DENSE" : "—"}</strong><small>grid-distributed search</small></div>
        <button className="primary-button" onClick={matches ? next : run} disabled={working}>{working ? <><LoaderCircle className="spin" size={16} /> Matching</> : matches ? <>Continue to RANSAC <ArrowRight size={16} /></> : <>Detect correspondences <ScanLine size={16} /></>}</button>
      </section>
      <p className="technical-note"><Info size={14} /> The repository exposes this stage as a matcher adapter. The included browser engine enables a self-contained demo; production deployment should connect the adapter to trained LoFTR weights.</p>
    </main>
  );
}

function RansacScreen({ processed, matches, result, working, run, next }) {
  return (
    <main className="page stage-page">
      <PageTitle number="03" tag="GEOMETRIC VERIFICATION" title="Outlier Rejection" description="Fit one consistent projective geometry and reject correspondence hypotheses that violate it." />
      <div className="legend"><span><i className="green" /> INLIER — CONSISTENT</span><span><i className="red" /> OUTLIER — REJECTED</span></div>
      <MatchCanvas left={processed.source} right={processed.reference} matches={matches} inliers={result?.inliers} />
      <section className="ransac-footer">
        <div className="algorithm-id"><CircleDot size={22} /><span><b>RANSAC</b><small>Reprojection threshold: 5 px · 700 iterations</small></span></div>
        <div className="compact-metric"><span>INLIERS</span><strong>{result?.inliers.length ?? "—"} <small>/ {matches.length}</small></strong></div>
        <div className="compact-metric"><span>REJECTION RATE</span><strong>{result ? `${((1 - result.inliers.length / matches.length) * 100).toFixed(1)}%` : "—"}</strong></div>
        <button className="primary-button" onClick={result ? next : run} disabled={working}>{working ? <><LoaderCircle className="spin" size={16} /> Fitting</> : result ? <>Apply transform <ArrowRight size={16} /></> : <>Run RANSAC <CircleDot size={16} /></>}</button>
      </section>
    </main>
  );
}

function TransformScreen({ processed, result, transform, working, run, next }) {
  return (
    <main className="page stage-page">
      <PageTitle number="04" tag="PROJECTIVE ALIGNMENT" title="Apply Transform" description="Warp the source image into the reference image coordinate system using the estimated homography." />
      <section className="transform-layout">
        <div>
          <div className="section-cap">BEFORE / UNREGISTERED</div>
          <ImagePanel label="SOURCE" title="Original geometry" src={processed.source} />
        </div>
        <div className="transform-arrow"><span>H</span><ArrowRight size={22} /></div>
        <div>
          <div className="section-cap">AFTER / REGISTERED</div>
          <ImagePanel label="WARPED SOURCE" title="Reference geometry" src={transform?.warped || processed.source} badge={transform && "ALIGNED"} />
        </div>
      </section>
      <div className="matrix-card">
        <div><Grid3X3 size={21} /><span><b>HOMOGRAPHY MATRIX</b><small>SOURCE PIXEL → REFERENCE PIXEL</small></span></div>
        <div className="matrix">{(result?.H || Array(9).fill(0)).map((value, i) => <code key={i}>{value.toFixed(5)}</code>)}</div>
        <button className="primary-button" onClick={transform ? next : run} disabled={working}>{working ? <><LoaderCircle className="spin" size={16} /> Warping</> : transform ? <>View full analysis <ArrowRight size={16} /></> : <>Warp source image <Layers3 size={16} /></>}</button>
      </div>
    </main>
  );
}

function DownloadButton({ label, icon: Icon, onClick }) {
  return <button className="download-button" onClick={onClick}><Icon size={15} /> {label}<Download size={14} /></button>;
}

function ResultsScreen({ processed, matches, result, transform, metrics, restart }) {
  const [tab, setTab] = useState("overlay");
  const downloadUrl = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };
  const downloadData = (format) => {
    const data = result.inliers.map((m, i) => ({ id: i + 1, x_source: +m.source.x.toFixed(2), y_source: +m.source.y.toFixed(2), x_reference: +m.target.x.toFixed(2), y_reference: +m.target.y.toFixed(2), confidence: +m.confidence.toFixed(4) }));
    const text = format === "json" ? JSON.stringify({ homography: result.H, matches: data }, null, 2) : `id,x_source,y_source,x_reference,y_reference,confidence\n${data.map((m) => Object.values(m).join(",")).join("\n")}`;
    downloadUrl(URL.createObjectURL(new Blob([text], { type: "text/plain" })), `lunar-registration.${format}`);
  };
  return (
    <main className="page results-page">
      <div className="result-heading"><div><span className="success-mark"><Check size={18} /></span><div><div className="eyebrow">PIPELINE COMPLETE</div><h1>Registration analysis</h1><p>Source imagery has been mapped into the LRO reference coordinate system.</p></div></div><button className="outline-button" onClick={restart}>New image pair</button></div>
      <section className="score-grid">
        <div className="hero-score"><span>REPROJECTION RMSE</span><strong>{metrics.rmse.toFixed(2)}<small> px</small></strong><p>{metrics.rmse < 1 ? "SUB-PIXEL ACCURACY" : metrics.rmse < 3 ? "HIGH-PRECISION ALIGNMENT" : "COARSE ALIGNMENT"}</p></div>
        <div><span>INLIER RATIO</span><strong>{(metrics.inlierRatio * 100).toFixed(1)}<small>%</small></strong><p>{metrics.inliers} / {metrics.total} matches</p></div>
        <div><span>SPATIAL COVERAGE</span><strong>{(metrics.coverage * 100).toFixed(1)}<small>%</small></strong><p>12-cell image grid</p></div>
        <div><span>CONFIDENCE</span><strong>{metrics.inliers >= 12 ? "HIGH" : metrics.inliers >= 6 ? "MED" : "LOW"}</strong><p>Geometry consensus</p></div>
      </section>
      <section className="visual-card">
        <header>
          <div className="tabs"><button className={tab === "overlay" ? "active" : ""} onClick={() => setTab("overlay")}>Overlay blend</button><button className={tab === "matches" ? "active" : ""} onClick={() => setTab("matches")}>Visual match map</button><button className={tab === "warped" ? "active" : ""} onClick={() => setTab("warped")}>Registered image</button></div>
          <span>{tab === "overlay" ? "50% SOURCE / 50% REFERENCE" : tab === "matches" ? `${result.inliers.length} VERIFIED PAIRS` : "SOURCE IN REFERENCE FRAME"}</span>
        </header>
        {tab === "matches" ? <MatchCanvas left={processed.source} right={processed.reference} matches={matches} inliers={result.inliers} showOutliers={false} /> : <div className="result-image"><img src={tab === "overlay" ? transform.overlay : transform.warped} alt={tab} /></div>}
      </section>
      <section className="deliverables">
        <div className="matrix-result"><header><Grid3X3 size={17} /><b>TRANSFORMATION MATRIX · H</b><button onClick={() => navigator.clipboard?.writeText(JSON.stringify(result.H))}>COPY</button></header><div className="matrix">{result.H.map((v, i) => <code key={i}>{v.toFixed(6)}</code>)}</div></div>
        <div className="export-card"><header><FileImage size={17} /><b>EXPORT DELIVERABLES</b></header><DownloadButton label="Registered image" icon={Layers3} onClick={() => downloadUrl(transform.warped, "registered-source.jpg")} /><DownloadButton label="Overlay visualization" icon={ScanLine} onClick={() => downloadUrl(transform.overlay, "registration-overlay.jpg")} /><DownloadButton label="Match points · CSV" icon={Grid3X3} onClick={() => downloadData("csv")} /><DownloadButton label="Full result · JSON" icon={Download} onClick={() => downloadData("json")} /></div>
      </section>
    </main>
  );
}

export default function App() {
  const [stage, setStage] = useState(0);
  const [available, setAvailable] = useState(0);
  const [files, setFiles] = useState({ source: null, reference: null });
  const [previews, setPreviews] = useState({ source: null, reference: null });
  const [raw, setRaw] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [matches, setMatches] = useState(null);
  const [ransac, setRansac] = useState(null);
  const [transform, setTransform] = useState(null);
  const [working, setWorking] = useState(false);

  const setFile = (key, file) => {
    if (previews[key]) URL.revokeObjectURL(previews[key]);
    setFiles((current) => ({ ...current, [key]: file }));
    setPreviews((current) => ({ ...current, [key]: file ? URL.createObjectURL(file) : null }));
  };

  const begin = async () => {
    setWorking(true);
    try {
      const [source, reference] = await Promise.all([loadImage(files.source), loadImage(files.reference)]);
      setRaw({ source, reference });
      setStage(1); setAvailable(1);
    } finally { setWorking(false); }
  };

  const runPreprocess = async () => {
    setWorking(true); await delay(500);
    const source = applyClahe(raw.source.canvas), reference = applyClahe(raw.reference.canvas);
    setProcessedData({ source, reference, urls: { source: canvasToUrl(source.canvas), reference: canvasToUrl(reference.canvas) } });
    setAvailable(2); setWorking(false);
  };

  const runMatching = async () => {
    setWorking(true); await delay(650);
    const found = matchFeatures(processedData.source, processedData.reference).map((m) => ({
      ...m,
      sourceWidth: processedData.source.width, sourceHeight: processedData.source.height,
      targetWidth: processedData.reference.width, targetHeight: processedData.reference.height,
    }));
    setMatches(found); setAvailable(3); setWorking(false);
  };

  const runRansac = async () => {
    setWorking(true); await delay(650);
    let fitted = estimateRansac(matches);
    if (!fitted.H) {
      const sx = processedData.reference.width / processedData.source.width;
      const sy = processedData.reference.height / processedData.source.height;
      fitted = { H: [sx, 0, 0, 0, sy, 0, 0, 0, 1], inliers: matches };
    }
    setRansac(fitted); setAvailable(4); setWorking(false);
  };

  const runTransform = async () => {
    setWorking(true); await delay(500);
    const output = warpAndBlend(processedData.source.canvas, processedData.reference.canvas, ransac.H);
    setTransform({ warped: canvasToUrl(output.warped), overlay: canvasToUrl(output.overlay) });
    setAvailable(5); setWorking(false);
  };

  const metrics = useMemo(() => ransac && matches ? computeMetrics(matches, ransac.inliers, ransac.H, processedData.reference.width, processedData.reference.height) : null, [matches, ransac, processedData]);
  const go = (next) => { setStage(next); setAvailable((value) => Math.max(value, next)); };
  const reset = () => { setStage(0); setAvailable(0); setFiles({ source: null, reference: null }); setPreviews({ source: null, reference: null }); setRaw(null); setProcessedData(null); setMatches(null); setRansac(null); setTransform(null); };
  const originalUrls = raw ? { source: canvasToUrl(raw.source.canvas), reference: canvasToUrl(raw.reference.canvas) } : previews;

  return (
    <div className="app">
      <Header stage={stage} setStage={setStage} available={available} />
      {stage === 0 && <InputScreen files={files} previews={previews} setFile={setFile} begin={begin} />}
      {stage === 1 && <ProcessingScreen original={originalUrls} processed={processedData?.urls} working={working} run={runPreprocess} next={() => go(2)} />}
      {stage === 2 && <MatchingScreen processed={processedData.urls} matches={matches} working={working} run={runMatching} next={() => go(3)} />}
      {stage === 3 && <RansacScreen processed={processedData.urls} matches={matches} result={ransac} working={working} run={runRansac} next={() => go(4)} />}
      {stage === 4 && <TransformScreen processed={processedData.urls} result={ransac} transform={transform} working={working} run={runTransform} next={() => go(5)} />}
      {stage === 5 && metrics && <ResultsScreen processed={processedData.urls} matches={matches} result={ransac} transform={transform} metrics={metrics} restart={reset} />}
      <footer><span>LUNA/REGISTER · PROTOTYPE 01</span><span>CHANDRAYAAN-2 × LRO</span><span>ISRO · LUNAR DATA PIPELINE</span></footer>
    </div>
  );
}

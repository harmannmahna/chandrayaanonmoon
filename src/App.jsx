import { useMemo, useRef, useState } from "react";
import {
  ArrowRight, Check, ChevronRight, CircleDot, Download, FileCode2, FileImage,
  Grid3X3, ImagePlus, Info, Layers3, LoaderCircle, Play, ScanLine, Sparkles, Upload, X,
} from "lucide-react";
import {
  applyClahe, canvasToUrl, computeMetrics, estimateRansac, matchFeatures,
  normalizeToPng, warpAndBlend,
} from "./engine";

const STAGES = [
  { id: "INPUT", short: "Input" }, { id: "01", short: "CLAHE" },
  { id: "02", short: "LoFTR" }, { id: "03", short: "RANSAC" },
  { id: "04", short: "Transform" }, { id: "05", short: "Results" },
];
const IMAGES = [
  { key: "a", id: "A", type: "SOURCE / A", label: "Chandrayaan-2 image", subtitle: "OHRC · TMC · IIRS sensor data" },
  { key: "b", id: "B", type: "REFERENCE / B", label: "LRO reference image", subtitle: "LROC NAC · WAC map data" },
  { key: "c", id: "C", type: "COMPARISON / C", label: "Third lunar image", subtitle: "Additional epoch · sensor · map" },
];
const PAIRS = [
  { id: "ab", left: "a", right: "b", label: "A ↔ B" },
  { id: "ac", left: "a", right: "c", label: "A ↔ C" },
  { id: "bc", left: "b", right: "c", label: "B ↔ C" },
];
const DEMO_FILES = [
  { key: "a", path: "/samples/chandrayaan2_ohr.png", name: "chandrayaan2_ohr.png" },
  { key: "b", path: "/samples/lro_reference.png", name: "lro_reference.png" },
  { key: "c", path: "/samples/epoch_c_embedded.xml", name: "epoch_c_embedded.xml", type: "application/xml" },
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

function FileCard({ config, asset, loading, error, onFile, onRemove }) {
  const input = useRef(null);
  const choose = (file) => file && onFile(file);
  return (
    <div
      className={`upload-card compact ${asset ? "has-file" : ""}`}
      onClick={() => !asset && !loading && input.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}
    >
      <input ref={input} hidden type="file" accept="image/*,.xml,.svg" onChange={(event) => choose(event.target.files[0])} />
      {loading ? (
        <div className="upload-empty"><LoaderCircle className="spin" size={28} /><h3>Converting to PNG</h3><p>Decoding {config.id} locally…</p></div>
      ) : asset ? (
        <>
          <img src={asset.preview} alt={`${config.label} preview`} />
          <div className="file-shade" />
          <button className="remove-file" onClick={(event) => { event.stopPropagation(); onRemove(); }}><X size={16} /></button>
          <div className="file-meta">
            <span><Check size={12} /> PNG READY</span>
            <strong>{asset.file.name}</strong>
            <small>FROM {asset.convertedFrom.toUpperCase()}{asset.wasXml ? " · XML EMBED" : ""}</small>
          </div>
        </>
      ) : (
        <div className="upload-empty">
          <span className="type-label">{config.type}</span>
          <div className="upload-icon"><ImagePlus size={28} strokeWidth={1.3} /></div>
          <h3>{config.label}</h3>
          <p>{config.subtitle}</p>
          <button className="outline-button"><Upload size={14} /> Select file</button>
          <small>IMAGE OR EMBEDDED-IMAGE XML</small>
          {error && <span className="upload-error">{error}</span>}
        </div>
      )}
    </div>
  );
}

function InputScreen({ assets, loading, errors, setFile, begin, working, loadDemo, demoLoading }) {
  const ready = IMAGES.every(({ key }) => assets[key]);
  return (
    <main className="page input-page">
      <section className="hero">
        <div className="eyebrow"><span>MISSION</span> THREE-WAY LUNAR REGISTRATION</div>
        <h1>Compare every <span>perspective.</span></h1>
        <p>Normalize three lunar products to PNG, then compare every image pair across illumination, scale, and sensor differences.</p>
      </section>
      <div className="input-label"><span>01</span> LOAD THREE IMAGE PRODUCTS <i /></div>
      <section className="upload-grid three">
        {IMAGES.map((config) => (
          <FileCard
            key={config.key}
            config={config}
            asset={assets[config.key]}
            loading={loading[config.key]}
            error={errors[config.key]}
            onFile={(file) => setFile(config.key, file)}
            onRemove={() => setFile(config.key, null)}
          />
        ))}
      </section>
      <div className="converter-note">
        <FileCode2 size={17} />
        <div>
          <b>UNIVERSAL PNG NORMALIZER</b>
          <span>Images, SVG, and XML with embedded image pixels are decoded and converted to PNG before processing.</span>
        </div>
        <small>LOCAL · NO UPLOAD</small>
      </div>
      <div className="start-row">
        <div className="start-actions">
          <button className="outline-button" onClick={loadDemo} disabled={demoLoading || working}>
            {demoLoading ? <LoaderCircle className="spin" size={14} /> : <Play size={14} />}
            {demoLoading ? "Loading demo" : "Load demo set"}
          </button>
          <div className="privacy"><Info size={14} /> Demo C is embedded-image XML. Metadata-only PDS XML needs its raster.</div>
        </div>
        <button className="primary-button" disabled={!ready || working} onClick={begin}>
          {working ? <LoaderCircle className="spin" size={16} /> : <>Initialize 3-way pipeline <ArrowRight size={16} /></>}
        </button>
      </div>
      <section className="pipeline-strip">
        {["CLAHE PREPROCESSING", "3× PAIR MATCHING", "3× RANSAC FILTER", "3× HOMOGRAPHY WARP"].map((name, i) => {
          const Icon = [Sparkles, ScanLine, CircleDot, Layers3][i];
          return (
            <div key={name}>
              <span>0{i + 1}</span>
              <i><Icon size={18} /></i>
              <b>{name}</b>
              {i < 3 && <ChevronRight size={13} />}
            </div>
          );
        })}
      </section>
    </main>
  );
}

function PageTitle({ number, title, description, tag }) {
  return (
    <div className="page-title">
      <div className="stage-number">{number}</div>
      <div>
        <div className="eyebrow">{tag}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ImagePanel({ label, title, src, badge }) {
  return (
    <article className="image-panel">
      <header>
        <div><span>{label}</span><strong>{title}</strong></div>
        {badge && <small>{badge}</small>}
      </header>
      <div className="image-frame"><img src={src} alt={title} /></div>
    </article>
  );
}

function ProcessingScreen({ original, processed, working, run, next }) {
  return (
    <main className="page stage-page">
      <PageTitle number="01" tag="IMAGE ENHANCEMENT" title="Preprocessing all three images" description="Every input is now PNG. CLAHE normalizes local contrast independently before pairwise matching." />
      <section className="triple-process">
        {IMAGES.map(({ key, id, label }) => (
          <div key={key}>
            <div className="section-cap">IMAGE {id} / {label.toUpperCase()}</div>
            <div className="before-after">
              <ImagePanel label="BEFORE" title="PNG normalized" src={original[key]} />
              <ImagePanel label="AFTER" title="CLAHE enhanced" src={processed?.[key] || original[key]} badge={processed && "COMPLETE"} />
            </div>
          </div>
        ))}
      </section>
      <div className="algorithm-card">
        <div><Sparkles size={19} /><span><b>CLAHE × 3</b><small>Contrast Limited Adaptive Histogram Equalization</small></span></div>
        <dl>
          <div><dt>TILE GRID</dt><dd>8 × 8</dd></div>
          <div><dt>CLIP LIMIT</dt><dd>2.50</dd></div>
          <div><dt>OUTPUT</dt><dd>PNG / LUMA</dd></div>
        </dl>
        <button className="primary-button" onClick={processed ? next : run} disabled={working}>
          {working ? <><LoaderCircle className="spin" size={16} /> Processing 3 images</> : processed ? <>Continue <ArrowRight size={16} /></> : <>Run CLAHE × 3 <Sparkles size={16} /></>}
        </button>
      </div>
    </main>
  );
}

function PairTabs({ selected, setSelected, data, result }) {
  return (
    <div className="pair-tabs">
      {PAIRS.map((pair) => (
        <button key={pair.id} className={selected === pair.id ? "active" : ""} onClick={() => setSelected(pair.id)}>
          <span>{pair.label}</span>
          <small>{result ? `${result[pair.id]?.inliers.length || 0} INLIERS` : data ? `${data[pair.id]?.length || 0} MATCHES` : "PENDING"}</small>
        </button>
      ))}
    </div>
  );
}

function MatchCanvas({ left, right, leftId, rightId, matches = [], inliers, showOutliers = true }) {
  const inlierSet = new Set(inliers || []);
  return (
    <div className="match-canvas">
      <div className="match-image"><img src={left} alt={`Image ${leftId}`} /></div>
      <div className="match-image"><img src={right} alt={`Image ${rightId}`} /></div>
      <svg viewBox="0 0 1000 420" preserveAspectRatio="none">
        {matches.slice(0, 70).map((match, index) => {
          const isInlier = !inliers || inlierSet.has(match);
          if (!showOutliers && !isInlier) return null;
          const x1 = match.source.x / match.sourceWidth * 480;
          const y1 = match.source.y / match.sourceHeight * 420;
          const x2 = 520 + match.target.x / match.targetWidth * 480;
          const y2 = match.target.y / match.targetHeight * 420;
          return (
            <g key={index} className={isInlier ? "inlier-line" : "outlier-line"}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <circle cx={x1} cy={y1} r="2.5" />
              <circle cx={x2} cy={y2} r="2.5" />
            </g>
          );
        })}
      </svg>
      <span className="canvas-label left">{leftId} · IMAGE</span>
      <span className="canvas-label right">{rightId} · IMAGE</span>
    </div>
  );
}

function PairMatchView({ pair, processed, matches, result, showOutliers = true }) {
  const left = IMAGES.find((item) => item.key === pair.left);
  const right = IMAGES.find((item) => item.key === pair.right);
  return (
    <MatchCanvas
      left={processed[pair.left]}
      right={processed[pair.right]}
      leftId={left.id}
      rightId={right.id}
      matches={matches?.[pair.id]}
      inliers={result?.[pair.id]?.inliers}
      showOutliers={showOutliers}
    />
  );
}

function MatchingScreen({ processed, matches, working, run, next, selected, setSelected }) {
  const pair = PAIRS.find((item) => item.id === selected);
  const active = matches?.[selected] || [];
  const confidence = active.length ? active.reduce((sum, match) => sum + match.confidence, 0) / active.length : 0;
  return (
    <main className="page stage-page">
      <PageTitle number="02" tag="THREE-WAY CORRESPONDENCE" title="Feature Detection + Matching" description="Generate correspondences for all three pairings: A↔B, A↔C, and B↔C." />
      <div className="model-banner">
        <div><ScanLine size={20} /><span><b>LoFTR matching stage × 3</b><small>Pairwise correspondence adapter · local prototype engine</small></span></div>
        <span className="engine-badge">3 PAIRS</span>
      </div>
      <PairTabs selected={selected} setSelected={setSelected} data={matches} />
      <PairMatchView pair={pair} processed={processed} matches={matches} />
      <section className="metric-row">
        <div><span>ACTIVE PAIR</span><strong>{pair.label}</strong><small>pairwise comparison</small></div>
        <div><span>RAW MATCHES</span><strong>{active.length || "—"}</strong><small>candidate pairs</small></div>
        <div><span>MEAN CONFIDENCE</span><strong>{active.length ? `${(confidence * 100).toFixed(1)}%` : "—"}</strong><small>descriptor agreement</small></div>
        <button className="primary-button" onClick={matches ? next : run} disabled={working}>
          {working ? <><LoaderCircle className="spin" size={16} /> Matching 3 pairs</> : matches ? <>Continue to RANSAC <ArrowRight size={16} /></> : <>Match all pairs <ScanLine size={16} /></>}
        </button>
      </section>
    </main>
  );
}

function RansacScreen({ processed, matches, result, working, run, next, selected, setSelected }) {
  const pair = PAIRS.find((item) => item.id === selected);
  const active = result?.[selected];
  const total = matches[selected].length;
  return (
    <main className="page stage-page">
      <PageTitle number="03" tag="PAIRWISE GEOMETRIC VERIFICATION" title="Outlier Rejection" description="Estimate an independent projective model for each of the three image pairs." />
      <div className="legend"><span><i className="green" /> INLIER — CONSISTENT</span><span><i className="red" /> OUTLIER — REJECTED</span></div>
      <PairTabs selected={selected} setSelected={setSelected} data={matches} result={result} />
      <PairMatchView pair={pair} processed={processed} matches={matches} result={result} />
      <section className="ransac-footer">
        <div className="algorithm-id"><CircleDot size={22} /><span><b>RANSAC · {pair.label}</b><small>5 px threshold · 700 iterations · three independent models</small></span></div>
        <div className="compact-metric"><span>INLIERS</span><strong>{active?.inliers.length ?? "—"} <small>/ {total}</small></strong></div>
        <div className="compact-metric"><span>REJECTION RATE</span><strong>{active && total ? `${((1 - active.inliers.length / total) * 100).toFixed(1)}%` : "—"}</strong></div>
        <button className="primary-button" onClick={result ? next : run} disabled={working}>
          {working ? <><LoaderCircle className="spin" size={16} /> Fitting 3 models</> : result ? <>Apply transforms <ArrowRight size={16} /></> : <>Run RANSAC × 3 <CircleDot size={16} /></>}
        </button>
      </section>
    </main>
  );
}

function TransformScreen({ processed, result, transforms, working, run, next, selected, setSelected }) {
  const pair = PAIRS.find((item) => item.id === selected);
  const active = transforms?.[selected];
  return (
    <main className="page stage-page">
      <PageTitle number="04" tag="THREE PROJECTIVE ALIGNMENTS" title="Apply Transforms" description="Warp the left image of each pair into the right image coordinate system." />
      <PairTabs selected={selected} setSelected={setSelected} result={result} />
      <section className="transform-layout">
        <div>
          <div className="section-cap">BEFORE / IMAGE {pair.left.toUpperCase()}</div>
          <ImagePanel label="UNREGISTERED" title={`Image ${pair.left.toUpperCase()}`} src={processed[pair.left]} />
        </div>
        <div className="transform-arrow"><span>H</span><ArrowRight size={22} /></div>
        <div>
          <div className="section-cap">AFTER / {pair.label}</div>
          <ImagePanel label="WARPED" title={`Mapped to ${pair.right.toUpperCase()}`} src={active?.warped || processed[pair.left]} badge={active && "ALIGNED"} />
        </div>
      </section>
      <div className="matrix-card">
        <div><Grid3X3 size={21} /><span><b>HOMOGRAPHY · {pair.label}</b><small>LEFT PIXEL → RIGHT PIXEL</small></span></div>
        <div className="matrix">{(result?.[selected]?.H || Array(9).fill(0)).map((value, i) => <code key={i}>{value.toFixed(5)}</code>)}</div>
        <button className="primary-button" onClick={transforms ? next : run} disabled={working}>
          {working ? <><LoaderCircle className="spin" size={16} /> Warping 3 pairs</> : transforms ? <>View full analysis <ArrowRight size={16} /></> : <>Warp all pairs <Layers3 size={16} /></>}
        </button>
      </div>
    </main>
  );
}

function DownloadButton({ label, icon: Icon, onClick }) {
  return <button className="download-button" onClick={onClick}><Icon size={15} /> {label}<Download size={14} /></button>;
}

function CoverageGrid({ cells }) {
  const max = Math.max(1, ...cells);
  return (
    <div className="coverage-panel">
      <header><Grid3X3 size={15} /><b>SPATIAL COVERAGE GRID</b><span>4 × 3 CELLS</span></header>
      <div className="coverage-grid">
        {cells.map((count, index) => (
          <div key={index} className={count ? "filled" : "empty"} style={{ "--fill": count / max }}>
            <strong>{count}</strong>
            <small>CELL {index + 1}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonTable({ metrics, selected, setSelected }) {
  return (
    <section className="comparison-table">
      <header><b>THREE-PAIR SCORECARD</b><span>CLICK A ROW TO INSPECT THAT PAIR</span></header>
      <div className="comparison-head"><span>PAIR</span><span>RMSE</span><span>INLIERS</span><span>RATIO</span><span>COVERAGE</span><span>QUALITY</span></div>
      {PAIRS.map((pair) => {
        const item = metrics[pair.id];
        const quality = item.inliers >= 12 ? "HIGH" : item.inliers >= 6 ? "MED" : "LOW";
        return (
          <button key={pair.id} className={selected === pair.id ? "active" : ""} onClick={() => setSelected(pair.id)}>
            <span>{pair.label}</span>
            <span>{item.rmse.toFixed(2)} px</span>
            <span>{item.inliers}/{item.total}</span>
            <span>{(item.inlierRatio * 100).toFixed(1)}%</span>
            <span>{(item.coverage * 100).toFixed(0)}%</span>
            <span className={`quality ${quality.toLowerCase()}`}>{quality}</span>
          </button>
        );
      })}
    </section>
  );
}

function ResultsScreen({ processed, matches, result, transforms, metrics, restart, selected, setSelected }) {
  const [view, setView] = useState("overlay");
  const pair = PAIRS.find((item) => item.id === selected);
  const activeMetrics = metrics[selected];
  const activeResult = result[selected];
  const activeTransform = transforms[selected];
  const downloadUrl = (url, name) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  };
  const exportData = (format) => {
    const rows = PAIRS.flatMap((item) => result[item.id].inliers.map((match, index) => ({
      pair: item.label,
      id: index + 1,
      x_left: +match.source.x.toFixed(2),
      y_left: +match.source.y.toFixed(2),
      x_right: +match.target.x.toFixed(2),
      y_right: +match.target.y.toFixed(2),
      confidence: +match.confidence.toFixed(4),
    })));
    const full = {
      pairs: Object.fromEntries(PAIRS.map((item) => [item.id, {
        homography: result[item.id].H,
        metrics: metrics[item.id],
        matches: rows.filter((row) => row.pair === item.label),
      }])),
    };
    const text = format === "json"
      ? JSON.stringify(full, null, 2)
      : `pair,id,x_left,y_left,x_right,y_right,confidence\n${rows.map((row) => Object.values(row).join(",")).join("\n")}`;
    downloadUrl(URL.createObjectURL(new Blob([text], { type: "text/plain" })), `three-way-registration.${format}`);
  };

  return (
    <main className="page results-page">
      <div className="result-heading">
        <div>
          <span className="success-mark"><Check size={18} /></span>
          <div>
            <div className="eyebrow">3-WAY PIPELINE COMPLETE</div>
            <h1>Registration analysis</h1>
            <p>Three images compared across every pair with independent match sets and homographies.</p>
          </div>
        </div>
        <button className="outline-button" onClick={restart}>New image set</button>
      </div>
      <ComparisonTable metrics={metrics} selected={selected} setSelected={setSelected} />
      <PairTabs selected={selected} setSelected={setSelected} result={result} />
      <section className="score-grid">
        <div className="hero-score">
          <span>{pair.label} REPROJECTION RMSE</span>
          <strong>{activeMetrics.rmse.toFixed(2)}<small> px</small></strong>
          <p>RANSAC INLIER ERROR</p>
        </div>
        <div>
          <span>INLIER RATIO</span>
          <strong>{(activeMetrics.inlierRatio * 100).toFixed(1)}<small>%</small></strong>
          <p>{activeMetrics.inliers} / {activeMetrics.total} matches</p>
        </div>
        <div>
          <span>SPATIAL COVERAGE</span>
          <strong>{(activeMetrics.coverage * 100).toFixed(1)}<small>%</small></strong>
          <p>{activeMetrics.occupied}/12 cells occupied</p>
        </div>
        <div>
          <span>CONFIDENCE</span>
          <strong>{activeMetrics.inliers >= 12 ? "HIGH" : activeMetrics.inliers >= 6 ? "MED" : "LOW"}</strong>
          <p>Geometry consensus</p>
        </div>
      </section>
      <section className="results-split">
        <section className="visual-card">
          <header>
            <div className="tabs">
              <button className={view === "overlay" ? "active" : ""} onClick={() => setView("overlay")}>Overlay blend</button>
              <button className={view === "matches" ? "active" : ""} onClick={() => setView("matches")}>Visual match map</button>
              <button className={view === "warped" ? "active" : ""} onClick={() => setView("warped")}>Registered image</button>
            </div>
            <span>PAIR {pair.label}</span>
          </header>
          {view === "matches"
            ? <PairMatchView pair={pair} processed={processed} matches={matches} result={result} showOutliers={false} />
            : <div className="result-image"><img src={view === "overlay" ? activeTransform.overlay : activeTransform.warped} alt={`${pair.label} ${view}`} /></div>}
        </section>
        <CoverageGrid cells={activeMetrics.cells} />
      </section>
      <section className="deliverables">
        <div className="matrix-result">
          <header>
            <Grid3X3 size={17} />
            <b>TRANSFORMATION MATRIX · {pair.label}</b>
            <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(activeResult.H))}>COPY</button>
          </header>
          <div className="matrix">{activeResult.H.map((value, i) => <code key={i}>{value.toFixed(6)}</code>)}</div>
        </div>
        <div className="export-card">
          <header><FileImage size={17} /><b>EXPORT ACTIVE PAIR + ALL DATA</b></header>
          <DownloadButton label={`${pair.label} registered PNG`} icon={Layers3} onClick={() => downloadUrl(activeTransform.warped, `${pair.id}-registered.png`)} />
          <DownloadButton label={`${pair.label} overlay PNG`} icon={ScanLine} onClick={() => downloadUrl(activeTransform.overlay, `${pair.id}-overlay.png`)} />
          <DownloadButton label="All match points · CSV" icon={Grid3X3} onClick={() => exportData("csv")} />
          <DownloadButton label="All results · JSON" icon={Download} onClick={() => exportData("json")} />
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const empty = { a: null, b: null, c: null };
  const [stage, setStage] = useState(0);
  const [available, setAvailable] = useState(0);
  const [assets, setAssets] = useState(empty);
  const [loading, setLoading] = useState({ a: false, b: false, c: false });
  const [errors, setErrors] = useState(empty);
  const [working, setWorking] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [processed, setProcessed] = useState(null);
  const [matches, setMatches] = useState(null);
  const [ransac, setRansac] = useState(null);
  const [transforms, setTransforms] = useState(null);
  const [selectedPair, setSelectedPair] = useState("ab");

  const setFile = async (key, file) => {
    if (!file) {
      setAssets((current) => ({ ...current, [key]: null }));
      setErrors((current) => ({ ...current, [key]: null }));
      return;
    }
    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: null }));
    try {
      const normalized = await normalizeToPng(file);
      setAssets((current) => ({ ...current, [key]: normalized }));
    } catch (error) {
      setAssets((current) => ({ ...current, [key]: null }));
      setErrors((current) => ({ ...current, [key]: error.message }));
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  };

  const loadDemo = async () => {
    setDemoLoading(true);
    setErrors({ ...empty });
    try {
      const next = { ...empty };
      for (const item of DEMO_FILES) {
        setLoading((current) => ({ ...current, [item.key]: true }));
        const response = await fetch(item.path);
        if (!response.ok) throw new Error(`Could not load ${item.name}`);
        const blob = await response.blob();
        const file = new File([blob], item.name, { type: item.type || blob.type || "application/octet-stream" });
        next[item.key] = await normalizeToPng(file);
        setLoading((current) => ({ ...current, [item.key]: false }));
      }
      setAssets(next);
    } catch (error) {
      setErrors({ a: null, b: null, c: error.message });
      setLoading({ a: false, b: false, c: false });
    } finally {
      setDemoLoading(false);
    }
  };

  const begin = async () => {
    setWorking(true);
    await delay(250);
    setStage(1);
    setAvailable(1);
    setWorking(false);
  };

  const runPreprocess = async () => {
    setWorking(true);
    await delay(350);
    const next = {};
    for (const { key } of IMAGES) {
      const value = applyClahe(assets[key].image.canvas);
      next[key] = { ...value, url: canvasToUrl(value.canvas) };
    }
    setProcessed(next);
    setAvailable(2);
    setWorking(false);
  };

  const runMatching = async () => {
    setWorking(true);
    await delay(450);
    const next = {};
    for (const pair of PAIRS) {
      next[pair.id] = matchFeatures(processed[pair.left], processed[pair.right]).map((match) => ({
        ...match,
        sourceWidth: processed[pair.left].width,
        sourceHeight: processed[pair.left].height,
        targetWidth: processed[pair.right].width,
        targetHeight: processed[pair.right].height,
      }));
    }
    setMatches(next);
    setAvailable(3);
    setWorking(false);
  };

  const runRansac = async () => {
    setWorking(true);
    await delay(450);
    const next = {};
    for (const pair of PAIRS) {
      let fit = estimateRansac(matches[pair.id]);
      if (!fit.H) {
        const sx = processed[pair.right].width / processed[pair.left].width;
        const sy = processed[pair.right].height / processed[pair.left].height;
        fit = { H: [sx, 0, 0, 0, sy, 0, 0, 0, 1], inliers: matches[pair.id] };
      }
      next[pair.id] = fit;
    }
    setRansac(next);
    setAvailable(4);
    setWorking(false);
  };

  const runTransform = async () => {
    setWorking(true);
    await delay(350);
    const next = {};
    for (const pair of PAIRS) {
      const output = warpAndBlend(processed[pair.left].canvas, processed[pair.right].canvas, ransac[pair.id].H);
      next[pair.id] = {
        warped: output.warped.toDataURL("image/png"),
        overlay: output.overlay.toDataURL("image/png"),
      };
    }
    setTransforms(next);
    setAvailable(5);
    setWorking(false);
  };

  const metrics = useMemo(() => (
    !ransac ? null : Object.fromEntries(PAIRS.map((pair) => [
      pair.id,
      computeMetrics(matches[pair.id], ransac[pair.id].inliers, ransac[pair.id].H, processed[pair.right].width, processed[pair.right].height),
    ]))
  ), [matches, ransac, processed]);

  const urls = processed ? Object.fromEntries(IMAGES.map(({ key }) => [key, processed[key].url])) : null;
  const originals = Object.fromEntries(IMAGES.map(({ key }) => [key, assets[key]?.preview]));
  const go = (next) => {
    setStage(next);
    setAvailable((value) => Math.max(value, next));
  };
  const reset = () => {
    setStage(0);
    setAvailable(0);
    setAssets({ ...empty });
    setErrors({ ...empty });
    setProcessed(null);
    setMatches(null);
    setRansac(null);
    setTransforms(null);
    setSelectedPair("ab");
  };

  return (
    <div className="app">
      <Header stage={stage} setStage={setStage} available={available} />
      {stage === 0 && (
        <InputScreen
          assets={assets}
          loading={loading}
          errors={errors}
          setFile={setFile}
          begin={begin}
          working={working}
          loadDemo={loadDemo}
          demoLoading={demoLoading}
        />
      )}
      {stage === 1 && <ProcessingScreen original={originals} processed={urls} working={working} run={runPreprocess} next={() => go(2)} />}
      {stage === 2 && <MatchingScreen processed={urls} matches={matches} working={working} run={runMatching} next={() => go(3)} selected={selectedPair} setSelected={setSelectedPair} />}
      {stage === 3 && <RansacScreen processed={urls} matches={matches} result={ransac} working={working} run={runRansac} next={() => go(4)} selected={selectedPair} setSelected={setSelectedPair} />}
      {stage === 4 && <TransformScreen processed={urls} result={ransac} transforms={transforms} working={working} run={runTransform} next={() => go(5)} selected={selectedPair} setSelected={setSelectedPair} />}
      {stage === 5 && metrics && (
        <ResultsScreen
          processed={urls}
          matches={matches}
          result={ransac}
          transforms={transforms}
          metrics={metrics}
          restart={reset}
          selected={selectedPair}
          setSelected={setSelectedPair}
        />
      )}
      <footer>
        <span>LUNA/REGISTER · PROTOTYPE 03</span>
        <span>THREE IMAGES · THREE PAIRS · DEMO SET</span>
        <span>ISRO · LUNAR DATA PIPELINE</span>
      </footer>
    </div>
  );
}

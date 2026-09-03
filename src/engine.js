const MAX_SIZE = 900;

function decodeDataUri(uri) {
  return fetch(uri).then((response) => response.blob());
}

async function imageBlobFromXml(file) {
  const text = await file.text();
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("The XML document is not valid.");

  if (document.documentElement.localName.toLowerCase() === "svg") {
    return new Blob([new XMLSerializer().serializeToString(document.documentElement)], { type: "image/svg+xml" });
  }

  const dataUri = text.match(/data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+/i)?.[0];
  if (dataUri) return decodeDataUri(dataUri.replace(/\s/g, ""));

  const nodes = [...document.querySelectorAll("*")];
  const encoded = nodes.find((node) => {
    const encoding = `${node.getAttribute("encoding") || ""} ${node.getAttribute("content-transfer-encoding") || ""}`;
    return /base64/i.test(encoding) && (node.textContent || "").replace(/\s/g, "").length > 100;
  });
  if (encoded) {
    const mime = encoded.getAttribute("mime-type") || encoded.getAttribute("content-type") || "image/png";
    return decodeDataUri(`data:${mime};base64,${encoded.textContent.replace(/\s/g, "")}`);
  }

  const referenced = nodes.find((node) => /file_name|filename|href|source/i.test(node.localName || "") && node.textContent.trim());
  const suffix = referenced ? ` It references “${referenced.textContent.trim()}”; upload that raster file instead.` : "";
  throw new Error(`This XML is a metadata label and does not contain embedded image pixels.${suffix}`);
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ canvas, originalWidth: image.width, originalHeight: image.height });
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

export async function normalizeToPng(file) {
  const isXml = file.type.includes("xml") || /\.xml$/i.test(file.name);
  const source = isXml ? await imageBlobFromXml(file) : file;
  let loaded;
  try {
    loaded = await loadImage(source);
  } catch {
    throw new Error("This file cannot be decoded as an image in this browser. Use PNG, JPEG, WEBP, GIF, SVG, or embedded-image XML.");
  }
  const blob = await new Promise((resolve, reject) => loaded.canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG conversion failed.")), "image/png"));
  const baseName = file.name.replace(/\.[^.]+$/, "") || "lunar-image";
  return {
    file: new File([blob], `${baseName}.png`, { type: "image/png" }),
    image: loaded,
    preview: loaded.canvas.toDataURL("image/png"),
    convertedFrom: file.name,
    wasXml: isXml,
  };
}

export function canvasToUrl(canvas, quality = 0.92) {
  return canvas.toDataURL("image/jpeg", quality);
}

function grayscale(imageData) {
  const values = new Uint8ClampedArray(imageData.width * imageData.height);
  const { data } = imageData;
  for (let i = 0; i < values.length; i++) {
    const j = i * 4;
    values[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }
  return values;
}

export function applyClahe(source, tiles = 8, clipFactor = 2.5) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = grayscale(pixels);
  const out = new Uint8ClampedArray(gray.length);
  const tileW = Math.ceil(canvas.width / tiles);
  const tileH = Math.ceil(canvas.height / tiles);

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x0 = tx * tileW, y0 = ty * tileH;
      const x1 = Math.min(canvas.width, x0 + tileW), y1 = Math.min(canvas.height, y0 + tileH);
      const area = Math.max(1, (x1 - x0) * (y1 - y0));
      const hist = new Uint32Array(256);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[gray[y * canvas.width + x]]++;
      const limit = Math.max(1, Math.floor((area / 256) * clipFactor));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) { excess += hist[i] - limit; hist[i] = limit; }
      }
      const share = Math.floor(excess / 256);
      const remainder = excess % 256;
      for (let i = 0; i < 256; i++) hist[i] += share + (i < remainder ? 1 : 0);
      const lut = new Uint8Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) { sum += hist[i]; lut[i] = Math.min(255, Math.round(sum * 255 / area)); }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y * canvas.width + x] = lut[gray[y * canvas.width + x]];
    }
  }

  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    pixels.data[j] = pixels.data[j + 1] = pixels.data[j + 2] = out[i];
    pixels.data[j + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return { canvas, gray: out, width: canvas.width, height: canvas.height };
}

function gradientMap(gray, width, height) {
  const grad = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + width] - gray[i - width];
      grad[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return grad;
}

function detectDense(gray, width, height, cols = 14, rows = 10) {
  const grad = gradientMap(gray, width, height);
  const points = [];
  const cellW = width / cols, cellH = height / rows;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let best = 0, bx = 0, by = 0;
    const x0 = Math.max(6, Math.floor(cx * cellW));
    const x1 = Math.min(width - 6, Math.floor((cx + 1) * cellW));
    const y0 = Math.max(6, Math.floor(cy * cellH));
    const y1 = Math.min(height - 6, Math.floor((cy + 1) * cellH));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      const score = grad[y * width + x];
      if (score > best) { best = score; bx = x; by = y; }
    }
    if (best > 8) points.push({ x: bx, y: by, score: best, descriptor: describe(grad, width, height, bx, by) });
  }
  return points;
}

function describe(grad, width, height, x, y) {
  const d = [];
  for (let oy = -6; oy <= 6; oy += 3) for (let ox = -6; ox <= 6; ox += 3) {
    const px = Math.max(0, Math.min(width - 1, x + ox));
    const py = Math.max(0, Math.min(height - 1, y + oy));
    d.push(grad[py * width + px]);
  }
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const norm = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0)) || 1;
  return d.map((v) => (v - mean) / norm);
}

function descriptorDistance(a, b) {
  let value = 0;
  for (let i = 0; i < a.length; i++) value += (a[i] - b[i]) ** 2;
  return Math.sqrt(value);
}

export function matchFeatures(a, b) {
  const pa = detectDense(a.gray, a.width, a.height);
  const pb = detectDense(b.gray, b.width, b.height);
  const scaleX = b.width / a.width, scaleY = b.height / a.height;
  const candidates = [];
  for (let i = 0; i < pa.length; i++) {
    const ranked = pb.map((point, j) => {
      const appearance = descriptorDistance(pa[i].descriptor, point.descriptor);
      const nx = Math.abs(point.x / b.width - pa[i].x / a.width);
      const ny = Math.abs(point.y / b.height - pa[i].y / a.height);
      return { j, distance: appearance + 0.25 * Math.sqrt(nx * nx + ny * ny) };
    }).sort((x, y) => x.distance - y.distance);
    if (ranked.length > 1 && ranked[0].distance < ranked[1].distance * 0.94) {
      const target = pb[ranked[0].j];
      const geometricDistance = Math.hypot(target.x - pa[i].x * scaleX, target.y - pa[i].y * scaleY);
      const confidence = Math.max(0.2, Math.min(0.99, 1 - ranked[0].distance / 2.2)) * Math.exp(-geometricDistance / Math.max(b.width, b.height));
      candidates.push({ source: pa[i], target, confidence });
    }
  }
  candidates.sort((x, y) => y.confidence - x.confidence);
  const used = new Set();
  return candidates.filter((m) => {
    const key = `${m.target.x}:${m.target.y}`;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  }).slice(0, 120);
}

function solveLinear(A, b) {
  const n = b.length;
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    if (Math.abs(m[col][col]) < 1e-10) return null;
    const div = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= div;
    for (let row = 0; row < n; row++) if (row !== col) {
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }
  return m.map((row) => row[n]);
}

function homographyFrom(matches) {
  if (matches.length < 4) return null;
  const A = [], b = [];
  for (const m of matches) {
    const x = m.source.x, y = m.source.y, u = m.target.x, v = m.target.y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  if (A.length === 8) {
    const h = solveLinear(A, b);
    return h ? [...h, 1] : null;
  }
  const AtA = Array.from({ length: 8 }, () => Array(8).fill(0));
  const Atb = Array(8).fill(0);
  for (let r = 0; r < A.length; r++) for (let i = 0; i < 8; i++) {
    Atb[i] += A[r][i] * b[r];
    for (let j = 0; j < 8; j++) AtA[i][j] += A[r][i] * A[r][j];
  }
  const h = solveLinear(AtA, Atb);
  return h ? [...h, 1] : null;
}

export function project(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
}

export function estimateRansac(matches, threshold = 5, iterations = 700) {
  if (matches.length < 4) return { H: null, inliers: [] };
  let best = [];
  for (let iteration = 0; iteration < iterations; iteration++) {
    const selected = [];
    while (selected.length < 4) {
      const item = matches[Math.floor(Math.random() * matches.length)];
      if (!selected.includes(item)) selected.push(item);
    }
    const H = homographyFrom(selected);
    if (!H) continue;
    const inliers = matches.filter((m) => {
      const p = project(H, m.source.x, m.source.y);
      return Number.isFinite(p.x) && Math.hypot(p.x - m.target.x, p.y - m.target.y) <= threshold;
    });
    if (inliers.length > best.length) best = inliers;
  }
  const H = homographyFrom(best.length >= 4 ? best : matches.slice(0, 4));
  if (!H) return { H: null, inliers: [] };
  const inliers = matches.filter((m) => {
    const p = project(H, m.source.x, m.source.y);
    return Math.hypot(p.x - m.target.x, p.y - m.target.y) <= threshold;
  });
  return { H, inliers };
}

function invert3(m) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const A=e*i-f*h, B=c*h-b*i, C=b*f-c*e, D=f*g-d*i, E=a*i-c*g, F=c*d-a*f, G=d*h-e*g, H=b*g-a*h, I=a*e-b*d;
  const det=a*A+b*D+c*G;
  if (Math.abs(det) < 1e-12) return null;
  return [A,B,C,D,E,F,G,H,I].map((v) => v / det);
}

export function warpAndBlend(source, reference, H) {
  const warped = document.createElement("canvas");
  warped.width = reference.width; warped.height = reference.height;
  const srcCtx = source.getContext("2d", { willReadFrequently: true });
  const src = srcCtx.getImageData(0, 0, source.width, source.height);
  const outCtx = warped.getContext("2d");
  const out = outCtx.createImageData(warped.width, warped.height);
  const inv = invert3(H);
  if (!inv) return { warped, overlay: warped };
  for (let y = 0; y < warped.height; y++) for (let x = 0; x < warped.width; x++) {
    const p = project(inv, x, y);
    const sx = Math.round(p.x), sy = Math.round(p.y);
    if (sx >= 0 && sx < source.width && sy >= 0 && sy < source.height) {
      const si = (sy * source.width + sx) * 4, di = (y * warped.width + x) * 4;
      out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1]; out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  outCtx.putImageData(out, 0, 0);
  const overlay = document.createElement("canvas");
  overlay.width = reference.width; overlay.height = reference.height;
  const octx = overlay.getContext("2d");
  octx.globalAlpha = 1; octx.drawImage(reference, 0, 0);
  octx.globalAlpha = 0.5; octx.drawImage(warped, 0, 0);
  return { warped, overlay };
}

export function computeMetrics(matches, inliers, H, width, height) {
  const errors = inliers.map((m) => {
    const p = project(H, m.source.x, m.source.y);
    return Math.hypot(p.x - m.target.x, p.y - m.target.y);
  });
  const rmse = errors.length ? Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length) : 0;
  const counts = Array.from({ length: 12 }, () => 0);
  for (const m of inliers) {
    const cx = Math.min(3, Math.floor(m.target.x / width * 4));
    const cy = Math.min(2, Math.floor(m.target.y / height * 3));
    counts[cy * 4 + cx] += 1;
  }
  const occupied = counts.filter((count) => count > 0).length;
  return {
    rmse,
    inlierRatio: matches.length ? inliers.length / matches.length : 0,
    coverage: occupied / 12,
    occupied,
    cells: counts,
    total: matches.length,
    inliers: inliers.length,
  };
}

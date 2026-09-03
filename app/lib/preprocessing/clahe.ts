/**
 * CLAHE preprocessing for lunar imagery.
 */

export function runCLAHE(image: ImageData, tiles = 8, clipFactor = 2.5): ImageData {
  const width = image.width;
  const height = image.height;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(image.data[j] * 0.299 + image.data[j + 1] * 0.587 + image.data[j + 2] * 0.114);
  }

  const out = new Uint8ClampedArray(gray.length);
  const tileW = Math.ceil(width / tiles);
  const tileH = Math.ceil(height / tiles);

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(width, x0 + tileW);
      const y1 = Math.min(height, y0 + tileH);
      const area = Math.max(1, (x1 - x0) * (y1 - y0));
      const hist = new Uint32Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) hist[gray[y * width + x]]++;
      }
      const limit = Math.max(1, Math.floor((area / 256) * clipFactor));
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) {
          excess += hist[i] - limit;
          hist[i] = limit;
        }
      }
      const share = Math.floor(excess / 256);
      const remainder = excess % 256;
      for (let i = 0; i < 256; i++) hist[i] += share + (i < remainder ? 1 : 0);
      const lut = new Uint8Array(256);
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += hist[i];
        lut[i] = Math.min(255, Math.round((sum * 255) / area));
      }
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) out[y * width + x] = lut[gray[y * width + x]];
      }
    }
  }

  const result = new ImageData(width, height);
  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    result.data[j] = out[i];
    result.data[j + 1] = out[i];
    result.data[j + 2] = out[i];
    result.data[j + 3] = 255;
  }
  return result;
}

export function imageDataToDataUrl(image: ImageData, type: "image/png" | "image/jpeg" = "image/png"): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(image, 0, 0);
  return canvas.toDataURL(type);
}

export function imageDataFromUrl(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = () => reject(new Error("Failed to decode image URL"));
    image.src = url;
  });
}

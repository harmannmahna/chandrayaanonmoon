import { invertHomography, project } from "@/app/lib/ransac/ransac";
import { imageDataToDataUrl } from "@/app/lib/preprocessing/clahe";

export function applyHomography(image: ImageData, H: number[][]): ImageData {
  const inv = invertHomography(H);
  const out = new ImageData(image.width, image.height);
  if (!inv) return out;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const p = project(inv, x, y);
      const sx = Math.round(p.x);
      const sy = Math.round(p.y);
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const si = (sy * image.width + sx) * 4;
      const di = (y * image.width + x) * 4;
      out.data[di] = image.data[si];
      out.data[di + 1] = image.data[si + 1];
      out.data[di + 2] = image.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

export function warpToReference(
  source: ImageData,
  reference: ImageData,
  H: number[][],
): { warped: ImageData; overlay: ImageData; warpedUrl: string; overlayUrl: string } {
  const inv = invertHomography(H);
  const warped = new ImageData(reference.width, reference.height);
  if (inv) {
    for (let y = 0; y < reference.height; y++) {
      for (let x = 0; x < reference.width; x++) {
        const p = project(inv, x, y);
        const sx = Math.round(p.x);
        const sy = Math.round(p.y);
        if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
        const si = (sy * source.width + sx) * 4;
        const di = (y * reference.width + x) * 4;
        warped.data[di] = source.data[si];
        warped.data[di + 1] = source.data[si + 1];
        warped.data[di + 2] = source.data[si + 2];
        warped.data[di + 3] = 255;
      }
    }
  }

  const overlay = new ImageData(reference.width, reference.height);
  for (let i = 0; i < overlay.data.length; i += 4) {
    const hasWarp = warped.data[i + 3] > 0;
    if (!hasWarp) {
      overlay.data[i] = reference.data[i];
      overlay.data[i + 1] = reference.data[i + 1];
      overlay.data[i + 2] = reference.data[i + 2];
      overlay.data[i + 3] = 255;
    } else {
      overlay.data[i] = Math.round(reference.data[i] * 0.5 + warped.data[i] * 0.5);
      overlay.data[i + 1] = Math.round(reference.data[i + 1] * 0.5 + warped.data[i + 1] * 0.5);
      overlay.data[i + 2] = Math.round(reference.data[i + 2] * 0.5 + warped.data[i + 2] * 0.5);
      overlay.data[i + 3] = 255;
    }
  }

  return {
    warped,
    overlay,
    warpedUrl: imageDataToDataUrl(warped),
    overlayUrl: imageDataToDataUrl(overlay),
  };
}

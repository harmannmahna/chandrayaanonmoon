/**
 * Image-size guards for transparent performance limits.
 */

export const MAX_RECOMMENDED_EDGE = 2000;
export const LARGE_IMAGE_EDGE = 4000;
export const PREVIEW_DOWNSAMPLE_EDGE = 1600;

export type ImageSizeWarning = {
  level: "ok" | "warn" | "large";
  width: number;
  height: number;
  message: string | null;
  suggestDownsample: boolean;
};

export function assessImageSize(width: number, height: number): ImageSizeWarning {
  const edge = Math.max(width, height);
  if (edge > LARGE_IMAGE_EDGE) {
    return {
      level: "large",
      width,
      height,
      message: "Large image detected. Performance may be slow. Consider downsampling.",
      suggestDownsample: true,
    };
  }
  if (edge > MAX_RECOMMENDED_EDGE) {
    return {
      level: "warn",
      width,
      height,
      message: `Image is ${width}×${height}. Demo path is validated around ${MAX_RECOMMENDED_EDGE}×${MAX_RECOMMENDED_EDGE}; preview downsampling is recommended.`,
      suggestDownsample: true,
    };
  }
  return {
    level: "ok",
    width,
    height,
    message: null,
    suggestDownsample: false,
  };
}

/**
 * Optional preview downsample for large uploads.
 * Returns the original ImageData when already within the preview budget.
 */
export function maybeDownsampleForPreview(
  imageData: ImageData,
  maxEdge = PREVIEW_DOWNSAMPLE_EDGE,
): { imageData: ImageData; downsampled: boolean; scale: number } {
  const edge = Math.max(imageData.width, imageData.height);
  if (edge <= maxEdge) {
    return { imageData, downsampled: false, scale: 1 };
  }

  const scale = maxEdge / edge;
  const width = Math.max(1, Math.round(imageData.width * scale));
  const height = Math.max(1, Math.round(imageData.height * scale));
  const source = document.createElement("canvas");
  source.width = imageData.width;
  source.height = imageData.height;
  source.getContext("2d")!.putImageData(imageData, 0, 0);

  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, width, height);

  return {
    imageData: ctx.getImageData(0, 0, width, height),
    downsampled: true,
    scale,
  };
}

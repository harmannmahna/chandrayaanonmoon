import { assessImageSize, maybeDownsampleForPreview } from "@/app/lib/io/imageSizeGuards";
import { normalizeToPng } from "@/app/lib/io/normalize";
import { imageDataToDataUrl } from "@/app/lib/preprocessing/clahe";

export const ACCEPT_ATTRIBUTE =
  "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/*,.xml,.svg";

export const SUPPORTED_FORMATS_LABEL =
  "PNG, JPEG, WebP, GIF, SVG, or XML with an embedded image. No PDS .IMG.";

export type ImageMeta = {
  fileName: string;
  previewUrl: string;
  convertedFrom?: string;
  originalWidth: number;
  originalHeight: number;
  warning?: string | null;
  downsampled?: boolean;
};

/** Preview-facing slot image. Compatible with LoadedImage. */
export type ImageWithMeta = {
  previewUrl: string;
  fileName: string;
  imageData?: ImageData;
  sensorInfo?: import("@/app/lib/types").SensorInfo;
  originalWidth?: number;
  originalHeight?: number;
};

export function isAcceptedUploadFile(file: File): boolean {
  const name = file.name || "";
  if (/\.(img|lbl)$/i.test(name)) return false;
  if (/\.(png|jpe?g|webp|gif|svg|xml)$/i.test(name)) return true;
  if (/^(image\/(png|jpe?g|jpg|webp|gif|svg\+xml)|text\/xml|application\/xml)/i.test(file.type)) {
    return true;
  }
  if (file.type.startsWith("image/") && !/image\/(tiff|x-|\w*raw)/i.test(file.type)) {
    return true;
  }
  return false;
}

export function rejectionMessage(file: File): string {
  if (/\.(img|lbl)$/i.test(file.name)) {
    return "PDS .IMG is not supported in this prototype. Use PNG, JPEG, WebP, GIF, SVG, or XML with an embedded image.";
  }
  return `Unsupported file “${file.name}”. Use PNG, JPEG, WebP, GIF, SVG, or XML with an embedded image.`;
}

export function filesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  return Array.from(dataTransfer.files ?? []);
}

export async function prepareUploadFile(file: File): Promise<{
  imageData: ImageData;
  meta: ImageMeta;
}> {
  if (!file || file.size === 0) {
    throw new Error("The dropped file is empty.");
  }
  if (!isAcceptedUploadFile(file)) {
    throw new Error(rejectionMessage(file));
  }

  const normalized = await normalizeToPng(file);
  let imageData = normalized.imageData;
  let previewUrl = normalized.previewUrl;
  const originalWidth = imageData.width;
  const originalHeight = imageData.height;

  const notes: string[] = [];
  const warning = assessImageSize(imageData.width, imageData.height);
  if (warning.message) notes.push(warning.message);

  let downsampled = false;
  if (warning.suggestDownsample) {
    const preview = maybeDownsampleForPreview(imageData);
    if (preview.downsampled) {
      imageData = preview.imageData;
      previewUrl = imageDataToDataUrl(imageData);
      downsampled = true;
      notes.push("Preview downsampled for interactive use.");
    }
  }

  return {
    imageData,
    meta: {
      fileName: normalized.file.name,
      previewUrl,
      convertedFrom: normalized.convertedFrom,
      originalWidth,
      originalHeight,
      warning: notes.length ? notes.join(" ") : null,
      downsampled,
    },
  };
}

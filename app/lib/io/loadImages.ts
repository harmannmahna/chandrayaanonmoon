import type { DemoSetDescriptor, ImageDescriptor, ImageKey, LoadedImage } from "@/app/lib/types";
import { normalizeToPng } from "@/app/lib/io/normalize";

const IMAGE_KEYS: ImageKey[] = ["A", "B", "C"];

/**
 * Fetch a curated demo descriptor. Demo sets always include sensorInfo.
 */
export async function fetchDemoDescriptor(id = "demo_ch2_lro_01"): Promise<DemoSetDescriptor> {
  const response = await fetch(`/demo/${id}.json`);
  if (!response.ok) {
    throw new Error(`Could not load demo descriptor ${id}`);
  }
  const descriptor = (await response.json()) as DemoSetDescriptor;
  for (const key of IMAGE_KEYS) {
    if (!descriptor.images[key]?.sensorInfo) {
      throw new Error(`Demo set ${id} is missing mandatory sensorInfo for image ${key}`);
    }
  }
  return descriptor;
}

async function descriptorToFile(descriptor: ImageDescriptor): Promise<File> {
  const response = await fetch(descriptor.src);
  if (!response.ok) {
    throw new Error(`Could not load ${descriptor.src}`);
  }
  const blob = await response.blob();
  const name = descriptor.name || descriptor.src.split("/").pop() || "image.bin";
  const type =
    name.toLowerCase().endsWith(".xml")
      ? "application/xml"
      : blob.type || "application/octet-stream";
  return new File([blob], name, { type });
}

/**
 * Load a demo set and carry sensorInfo into each LoadedImage.
 */
export async function loadDemoSet(id = "demo_ch2_lro_01"): Promise<{
  descriptor: DemoSetDescriptor;
  images: Record<ImageKey, LoadedImage>;
}> {
  const descriptor = await fetchDemoDescriptor(id);
  const images = {} as Record<ImageKey, LoadedImage>;

  for (const key of IMAGE_KEYS) {
    const imageDescriptor = descriptor.images[key];
    const file = await descriptorToFile(imageDescriptor);
    const normalized = await normalizeToPng(file);
    images[key] = {
      key,
      fileName: normalized.file.name,
      imageData: normalized.imageData,
      previewUrl: normalized.previewUrl,
      sensorInfo: imageDescriptor.sensorInfo,
      convertedFrom: normalized.convertedFrom,
    };
  }

  return { descriptor, images };
}

/**
 * Load a user upload. sensorInfo is optional and may be attached later.
 */
export async function loadUserImage(
  key: ImageKey,
  file: File,
  sensorInfo?: ImageDescriptor["sensorInfo"],
): Promise<LoadedImage> {
  const normalized = await normalizeToPng(file);
  return {
    key,
    fileName: normalized.file.name,
    imageData: normalized.imageData,
    previewUrl: normalized.previewUrl,
    sensorInfo,
    convertedFrom: normalized.convertedFrom,
  };
}

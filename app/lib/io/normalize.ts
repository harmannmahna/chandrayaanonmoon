/**
 * Convert browser-decodable images / embedded-image XML into PNG-backed ImageData.
 */

const MAX_SIZE = 900;

function decodeDataUri(uri: string): Promise<Blob> {
  return fetch(uri).then((response) => response.blob());
}

async function imageBlobFromXml(file: File): Promise<Blob> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("The XML document is not valid.");
  }

  if (doc.documentElement.localName.toLowerCase() === "svg") {
    return new Blob([new XMLSerializer().serializeToString(doc.documentElement)], {
      type: "image/svg+xml",
    });
  }

  const dataUri = text.match(
    /data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+/i,
  )?.[0];
  if (dataUri) return decodeDataUri(dataUri.replace(/\s/g, ""));

  const nodes = [...doc.querySelectorAll("*")];
  const encoded = nodes.find((node) => {
    const encoding = `${node.getAttribute("encoding") || ""} ${node.getAttribute("content-transfer-encoding") || ""}`;
    return /base64/i.test(encoding) && (node.textContent || "").replace(/\s/g, "").length > 100;
  });

  if (encoded) {
    const mime =
      encoded.getAttribute("mime-type") ||
      encoded.getAttribute("content-type") ||
      "image/png";
    return decodeDataUri(`data:${mime};base64,${encoded.textContent!.replace(/\s/g, "")}`);
  }

  const referenced = nodes.find(
    (node) =>
      /file_name|filename|href|source/i.test(node.localName || "") &&
      node.textContent?.trim(),
  );
  const suffix = referenced
    ? ` It references “${referenced.textContent!.trim()}”; upload that raster file instead.`
    : "";
  throw new Error(
    `This XML is a metadata label and does not contain embedded image pixels.${suffix}`,
  );
}

function loadImageBitmap(source: Blob): Promise<{ canvas: HTMLCanvasElement; imageData: ImageData }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Could not create canvas context."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ canvas, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) });
    };
    image.onerror = () => reject(new Error("Image decode failed."));
    image.src = URL.createObjectURL(source);
  });
}

export async function normalizeToPng(file: File): Promise<{
  file: File;
  imageData: ImageData;
  previewUrl: string;
  convertedFrom: string;
  wasXml: boolean;
}> {
  const isXml = file.type.includes("xml") || /\.xml$/i.test(file.name);
  const source = isXml ? await imageBlobFromXml(file) : file;
  let loaded: { canvas: HTMLCanvasElement; imageData: ImageData };
  try {
    loaded = await loadImageBitmap(source);
  } catch {
    throw new Error(
      "This file cannot be decoded as an image in this browser. Use PNG, JPEG, WEBP, GIF, SVG, or embedded-image XML.",
    );
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    loaded.canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("PNG conversion failed."))),
      "image/png",
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "lunar-image";
  return {
    file: new File([blob], `${baseName}.png`, { type: "image/png" }),
    imageData: loaded.imageData,
    previewUrl: loaded.canvas.toDataURL("image/png"),
    convertedFrom: file.name,
    wasXml: isXml,
  };
}

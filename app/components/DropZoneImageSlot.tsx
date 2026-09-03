"use client";

import { useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent } from "react";
import type { SensorInfo } from "@/app/lib/types";
import {
  ACCEPT_ATTRIBUTE,
  SUPPORTED_FORMATS_LABEL,
  filesFromDataTransfer,
  prepareUploadFile,
  type ImageMeta,
  type ImageWithMeta,
} from "@/app/lib/io/prepareUpload";

export type { ImageMeta, ImageWithMeta };

type Props = {
  label: string;
  hint?: string;
  image: ImageWithMeta | null;
  sensorInfo?: SensorInfo;
  onImageLoaded: (file: File, imageData: ImageData, meta: ImageMeta) => void;
  onClear: () => void;
  disabled?: boolean;
};

function hasFilePayload(event: ReactDragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function DropZoneImageSlot({
  label,
  hint,
  image,
  sensorInfo,
  onImageLoaded,
  onClear,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const openPicker = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    setBusy(true);
    setLocalError(null);
    try {
      const prepared = await prepareUploadFile(file);
      onImageLoaded(file, prepared.imageData, prepared.meta);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      data-drop-slot
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label}. Click to upload or drag and drop. ${SUPPORTED_FORMATS_LABEL}`}
      aria-disabled={disabled || busy}
      onClick={openPicker}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={(event) => {
        if (disabled || !hasFilePayload(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(event) => {
        if (disabled || !hasFilePayload(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!hasFilePayload(event)) return;
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setDragOver(false);
        if (disabled) return;
        const file = filesFromDataTransfer(event.dataTransfer)[0];
        void handleFile(file);
      }}
      className={`panel cursor-pointer p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
        dragOver
          ? "border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]"
          : image
            ? ""
            : "!border-dashed"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="kicker">{label}</div>
          {hint || sensorInfo?.notes ? (
            <div className="muted mt-2 text-sm">{sensorInfo?.notes || hint}</div>
          ) : null}
        </div>
        {image ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setLocalError(null);
              onClear();
            }}
            disabled={disabled || busy}
            className="btn-ghost shrink-0 !px-2 !py-1 hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div
        className={`canvas-frame mt-4 flex h-40 items-center justify-center overflow-hidden ${
          dragOver ? "border-[var(--accent-primary)]" : ""
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.previewUrl} alt={`${label} preview`} className="h-full w-full object-cover grayscale" />
        ) : (
          <div className="px-4 text-center">
            <div className="text-xs text-[var(--text-primary)]">
              {busy ? "Reading file…" : dragOver ? "Drop to load this slot" : "Click to upload or drag & drop"}
            </div>
            <div className="muted mt-2 text-[10px] leading-5">{SUPPORTED_FORMATS_LABEL}</div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        disabled={disabled || busy}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
        }}
      />

      {image ? (
        <div className="muted mt-3 truncate text-[11px]">
          {image.fileName}
          {image.originalWidth && image.originalHeight
            ? ` · ${image.originalWidth}×${image.originalHeight}`
            : ""}
        </div>
      ) : null}

      {localError ? <p className="mt-3 text-xs leading-5 text-[var(--danger)]">{localError}</p> : null}
    </div>
  );
}

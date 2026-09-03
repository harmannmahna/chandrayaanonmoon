"use client";

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { filesFromDataTransfer } from "@/app/lib/io/prepareUpload";

type Props = {
  disabled?: boolean;
  onFilesDropped: (files: File[]) => void;
};

function hasFilePayload(event: DragEvent | ReactDragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function GlobalDropZoneBanner({ disabled = false, onFilesDropped }: Props) {
  const dragDepth = useRef(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (disabled) return;

    const onDragOver = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setActive(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget) return;
      setActive(false);
    };

    const onDrop = (event: DragEvent) => {
      setActive(false);
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-drop-slot]")) return;
      const files = filesFromDataTransfer(event.dataTransfer);
      if (files.length) onFilesDropped(files);
    };

    const onDragEnd = () => setActive(false);

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [disabled, onFilesDropped]);

  return (
    <div
      data-global-drop
      onDragEnter={(event) => {
        if (disabled || !hasFilePayload(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setActive(true);
      }}
      onDragOver={(event) => {
        if (disabled || !hasFilePayload(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setActive(false);
        if (disabled) return;
        const files = filesFromDataTransfer(event.dataTransfer);
        if (files.length) onFilesDropped(files);
      }}
      className={`border px-4 py-3 text-sm transition-colors ${
        active
          ? "border-[#d8ff3e] bg-[rgba(216,255,62,0.08)] text-[#e7e7e3]"
          : "border-dashed border-[#393937] bg-[#0d0d0d] text-[#9a9a96]"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span className="mono text-[10px] uppercase tracking-[0.14em] text-[#d8ff3e]">
        {active ? "Release to load" : "Drop zone"}
      </span>
      <p className="mt-1">
        {active
          ? "Drop to fill empty slots A / B / C, or drop onto a specific slot."
          : "Drag images here to fill empty slots A / B / C"}
      </p>
    </div>
  );
}

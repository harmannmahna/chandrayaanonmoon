"use client";

import { LunarBackdrop } from "@/app/components/LunarBackdrop";

type Props = {
  onStartDemo: () => void;
  onFocusUpload: () => void;
  loadingDemo?: boolean;
  working?: boolean;
};

/**
 * Cinematic but scientific Register hero.
 * Decorative moon only — controls stay in the workspace below.
 */
export function MissionHero({ onStartDemo, onFocusUpload, loadingDemo, working }: Props) {
  return (
    <section className="mission-hero" aria-label="Mission introduction">
      <LunarBackdrop variant="large" position="right" opacity={0.34} />

      <div className="mission-hero__copy">
        <div className="kicker">Lunar image registration system</div>
        <h1 className="mission-hero__title">
          Align the Moon.
          <br />
          Validate every match.
        </h1>
        <p className="mission-hero__body">
          Register multi-modal lunar imagery across changing illumination, viewpoint, and
          scale—then export the correspondence evidence and quality metrics.
        </p>
        <div className="mission-hero__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onStartDemo}
            disabled={loadingDemo || working}
          >
            {loadingDemo ? "Loading demo…" : "Start with demo data"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onFocusUpload}
            disabled={loadingDemo || working}
          >
            Upload your images
          </button>
        </div>
        <p className="mission-hero__status">
          Prototype · In-browser processing · LoFTR-style adapter
        </p>
      </div>
    </section>
  );
}

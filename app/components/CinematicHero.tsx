"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CinematicMoon } from "@/app/components/CinematicMoon";

type Scene = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta?: { label: string; href: string; solid?: boolean };
  secondary?: { label: string; href: string };
};

const SCENES: Scene[] = [
  {
    id: "align",
    kicker: "LUNA / REGISTER",
    title: "ALIGN THE MOON,\nPIXEL BY PIXEL",
    body: "Multi-modal Chandrayaan-2 × LRO registration — CLAHE, correspondence, RANSAC, and exportable proof.",
    cta: { label: "Enter workspace", href: "#workspace", solid: true },
  },
  {
    id: "sense",
    kicker: "MULTI-SENSOR",
    title: "OHRC · LRO · IIRS\nIN ONE FRAME",
    body: "Different resolutions and lighting. One shared coordinate system for morphology, mineralogy, and site analysis.",
    cta: { label: "See context", href: "/context", solid: false },
  },
  {
    id: "prove",
    kicker: "JUDGE-READY",
    title: "PROOF OVER\nPRETEND SUCCESS",
    body: "Overlays, coverage grids, quality badges, and Unreliable detection — so weak alignments stay honest.",
    cta: { label: "Start demo", href: "#workspace", solid: true },
    secondary: { label: "How to demo", href: "/?walkthrough=1&step=0" },
  },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Cinematic scroll intro inspired by space-landing aesthetics.
 * Original moon + copy for LUNA/REGISTER — no third-party assets copied.
 */
export function CinematicHero() {
  const rootRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setProgress(0);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(1, el.offsetHeight - window.innerHeight);
      const scrolled = clamp(-rect.top / total);
      setProgress(scrolled);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  const sceneIndex = Math.min(SCENES.length - 1, Math.floor(progress * SCENES.length));
  const scene = SCENES[sceneIndex];

  const moonStyle = useMemo(() => {
    // Scene-like keyframes: left/small → right/medium → left/huge
    const t = progress;
    const x =
      t < 0.45
        ? -6 + (t / 0.45) * 42
        : 36 - ((t - 0.45) / 0.55) * 68;
    const y = 2 + t * 6;
    const scale = 0.78 + t * 1.15;
    const rotate = -6 + t * 16;
    return {
      transform: `translate3d(${x}vw, ${y}vh, 0) scale(${scale}) rotate(${rotate}deg)`,
      opacity: 0.92,
    } as CSSProperties;
  }, [progress]);

  return (
    <section ref={rootRef} className="cinematic-hero" aria-label="Cinematic introduction">
      <div className="cinematic-hero__sticky">
        <div className="cinematic-hero__moon-stage">
          <div className="cinematic-hero__moon-track" style={reducedMotion ? undefined : moonStyle}>
            <CinematicMoon />
          </div>
        </div>

        <div className="cinematic-hero__content">
          <div key={scene.id} className="cinematic-hero__card">
            <div className="kicker">{scene.kicker}</div>
            <h1 className="cinematic-hero__title">{scene.title}</h1>
            <p className="cinematic-hero__body">{scene.body}</p>
            <div className="cinematic-hero__actions">
              {scene.cta ? (
                <a
                  href={scene.cta.href}
                  className={scene.cta.solid ? "cinematic-btn cinematic-btn--solid" : "cinematic-btn cinematic-btn--ghost"}
                >
                  {scene.cta.label}
                </a>
              ) : null}
              {scene.secondary ? (
                <a href={scene.secondary.href} className="cinematic-btn cinematic-btn--ghost">
                  {scene.secondary.label}
                </a>
              ) : null}
            </div>
          </div>

          <div className="cinematic-hero__progress" aria-hidden="true">
            {SCENES.map((item, index) => (
              <span
                key={item.id}
                className={`cinematic-hero__dot ${index === sceneIndex ? "is-active" : ""}`}
              />
            ))}
          </div>
          <p className="cinematic-hero__hint muted">Scroll to explore · workspace below</p>
        </div>
      </div>
    </section>
  );
}

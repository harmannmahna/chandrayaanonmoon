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
  /** text block horizontal bias: -1 left, 0 center, 1 right */
  align: -1 | 0 | 1;
};

const SCENES: Scene[] = [
  {
    id: "align",
    kicker: "LUNA / REGISTER",
    title: "ALIGN THE MOON\nPIXEL BY PIXEL",
    body: "Multi-modal Chandrayaan-2 × LRO registration — CLAHE, correspondence, RANSAC, and exportable proof.",
    cta: { label: "Explore", href: "#workspace", solid: true },
    align: 0,
  },
  {
    id: "sense",
    kicker: "MULTI-SENSOR",
    title: "WITH DENSE MATCHING\nWE GIVE LIFE TO\nYOUR IMAGINATION",
    body: "OHRC, LRO, and IIRS in one shared frame — different resolutions and lighting, one coordinate system.",
    cta: { label: "Curious", href: "/context", solid: false },
    align: -1,
  },
  {
    id: "prove",
    kicker: "JUDGE-READY",
    title: "PROOF OVER\nPRETEND SUCCESS",
    body: "Overlays, coverage grids, quality badges, and Unreliable detection — weak alignments stay honest so analysis stays trustworthy.",
    cta: { label: "Enter lab", href: "#workspace", solid: true },
    secondary: { label: "Go workspace", href: "#workspace" },
    align: 1,
  },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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

  const sceneIndex = Math.min(SCENES.length - 1, Math.floor(progress * SCENES.length * 0.999));

  const moonStyle = useMemo(() => {
    const t = progress;
    // left/small → right/medium → left-huge (edge bleed)
    const x =
      t < 0.42
        ? lerp(-8, 34, smoothstep(0, 0.42, t))
        : lerp(34, -48, smoothstep(0.42, 1, t));
    const y = lerp(4, 10, t);
    const scale = lerp(0.62, 2.15, smoothstep(0, 1, t));
    const rotate = lerp(-8, 14, t);
    return {
      transform: `translate3d(${x}vw, ${y}vh, 0) scale(${scale}) rotate(${rotate}deg)`,
    } as CSSProperties;
  }, [progress]);

  const starParallax = useMemo(
    () =>
      ({
        transform: `translate3d(0, ${progress * -4}vh, 0) scale(${1 + progress * 0.06})`,
      }) as CSSProperties,
    [progress],
  );

  return (
    <section ref={rootRef} className="cinematic-hero" aria-label="Cinematic introduction">
      <div className="cinematic-hero__sticky">
        <div className="cinematic-hero__stars" style={reducedMotion ? undefined : starParallax} aria-hidden="true" />

        <div className="cinematic-hero__moon-stage">
          <div className="cinematic-hero__moon-track" style={reducedMotion ? undefined : moonStyle}>
            <CinematicMoon />
          </div>
        </div>

        <div className="cinematic-hero__content">
          {SCENES.map((scene, index) => {
            const segment = 1 / SCENES.length;
            const start = index * segment;
            const end = start + segment;
            const fadeIn =
              index === 0 ? 1 : smoothstep(start - segment * 0.05, start + segment * 0.32, progress);
            const fadeOut =
              index === SCENES.length - 1
                ? 1
                : 1 - smoothstep(end - segment * 0.32, end + segment * 0.05, progress);
            const opacity = reducedMotion ? (index === 0 ? 1 : 0) : clamp(fadeIn * fadeOut);
            const visible = opacity > 0.02;

            const alignClass =
              scene.align === 0
                ? "cinematic-hero__card--center"
                : scene.align < 0
                  ? "cinematic-hero__card--left"
                  : "cinematic-hero__card--right";

            const lift = (1 - opacity) * 18;
            const transform =
              scene.align === 0
                ? `translate(-50%, calc(-50% + ${lift}px))`
                : `translateY(calc(-50% + ${lift}px))`;

            return (
              <div
                key={scene.id}
                className={`cinematic-hero__card ${alignClass}`}
                style={{
                  opacity,
                  pointerEvents: visible && opacity > 0.35 ? "auto" : "none",
                  transform: reducedMotion ? undefined : transform,
                }}
                aria-hidden={!visible}
              >
                <div className="kicker cinematic-hero__kicker">{scene.kicker}</div>
                <h1 className="cinematic-hero__title">{scene.title}</h1>
                <p className="cinematic-hero__body">{scene.body}</p>
                <div className="cinematic-hero__actions">
                  {scene.cta ? (
                    <a
                      href={scene.cta.href}
                      className={
                        scene.cta.solid
                          ? "cinematic-btn cinematic-btn--solid"
                          : "cinematic-btn cinematic-btn--ghost"
                      }
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
            );
          })}

          <div className="cinematic-hero__chrome">
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
      </div>
    </section>
  );
}

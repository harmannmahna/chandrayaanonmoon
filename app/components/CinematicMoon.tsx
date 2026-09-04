/**
 * Decorative moon disc using the local photographic asset.
 * Falls back gracefully if the image path is unavailable.
 */
export function CinematicMoon({ className = "" }: { className?: string }) {
  return (
    <div className={`cinematic-moon ${className}`} aria-hidden="true">
      <div className="cinematic-moon__glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lunar/full-moon.png"
        alt=""
        className="cinematic-moon__disc"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

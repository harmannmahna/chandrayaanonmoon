"use client";

/**
 * Original CSS/SVG moon — not sourced from external prototypes.
 * Lit from the left to mimic a cinematic lunar disc.
 */
export function CinematicMoon({ className = "" }: { className?: string }) {
  return (
    <div className={`cinematic-moon ${className}`} aria-hidden="true">
      <div className="cinematic-moon__glow" />
      <svg className="cinematic-moon__disc" viewBox="0 0 512 512" role="presentation">
        <defs>
          <radialGradient id="moonShade" cx="32%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#f7f4ee" />
            <stop offset="42%" stopColor="#d9d2c5" />
            <stop offset="78%" stopColor="#8f8778" />
            <stop offset="100%" stopColor="#3b3832" />
          </radialGradient>
          <radialGradient id="craterShade" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="55%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
          </radialGradient>
          <filter id="moonSoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
          </filter>
        </defs>
        <circle cx="256" cy="256" r="246" fill="url(#moonShade)" />
        <g fill="url(#craterShade)" opacity="0.9">
          <circle cx="170" cy="160" r="38" />
          <circle cx="300" cy="120" r="22" />
          <circle cx="350" cy="240" r="48" />
          <circle cx="210" cy="300" r="28" />
          <circle cx="140" cy="340" r="18" />
          <circle cx="280" cy="360" r="34" />
          <circle cx="380" cy="160" r="14" />
          <circle cx="240" cy="210" r="12" />
        </g>
        <g fill="none" stroke="rgba(40,35,28,0.35)" strokeWidth="2">
          <circle cx="170" cy="160" r="38" />
          <circle cx="350" cy="240" r="48" />
          <circle cx="280" cy="360" r="34" />
        </g>
        <ellipse
          cx="190"
          cy="150"
          rx="120"
          ry="80"
          fill="rgba(255,255,255,0.12)"
          filter="url(#moonSoft)"
        />
      </svg>
    </div>
  );
}

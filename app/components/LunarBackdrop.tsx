import { CinematicMoon } from "@/app/components/CinematicMoon";

type Variant = "small" | "large" | "terrain";
type Position = "left" | "right" | "center";

type Props = {
  variant?: Variant;
  position?: Position;
  opacity?: number;
  className?: string;
  /**
   * Optional local terrain image. Prefer project assets under /public.
   * TODO: replace with a properly licensed high-resolution lunar surface asset when available.
   */
  src?: string;
};

/**
 * Decorative grayscale lunar visual. Never interactive.
 * Uses procedural moon by default; optional local PNG for terrain variants.
 */
export function LunarBackdrop({
  variant = "large",
  position = "right",
  opacity = 0.28,
  className = "",
  src,
}: Props) {
  const useTerrain = variant === "terrain" || Boolean(src);
  // Local illustrative patches only — not photogrammetric mission products.
  const terrainSrc = src ?? "/samples/lro_reference.png";

  return (
    <div
      aria-hidden="true"
      className={`lunar-backdrop lunar-backdrop--${variant} lunar-backdrop--${position} ${className}`}
      style={{ opacity }}
    >
      {useTerrain ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={terrainSrc} alt="" className="lunar-backdrop__img" loading="lazy" />
      ) : (
        <div className="lunar-backdrop__orb">
          <CinematicMoon />
        </div>
      )}
    </div>
  );
}

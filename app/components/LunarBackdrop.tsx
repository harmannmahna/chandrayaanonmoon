type Variant = "small" | "large" | "terrain";
type Position = "left" | "right" | "center";

type Props = {
  variant?: Variant;
  position?: Position;
  opacity?: number;
  className?: string;
  /**
   * Optional override. Defaults to local assets under /public/lunar.
   * full-moon.png = disc · moon-horizon.png = terrain close-up.
   */
  src?: string;
};

const DEFAULT_SRC: Record<Variant, string> = {
  small: "/lunar/full-moon.png",
  large: "/lunar/full-moon.png",
  terrain: "/lunar/moon-horizon.png",
};

/**
 * Decorative grayscale lunar visual. Never interactive.
 * Uses user-provided local moon photography under /public/lunar.
 */
export function LunarBackdrop({
  variant = "large",
  position = "right",
  opacity = 0.42,
  className = "",
  src,
}: Props) {
  const imageSrc = src ?? DEFAULT_SRC[variant];
  const isTerrain = variant === "terrain";

  return (
    <div
      aria-hidden="true"
      className={`lunar-backdrop lunar-backdrop--${variant} lunar-backdrop--${position} ${className}`}
      style={{ opacity }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt=""
        className={isTerrain ? "lunar-backdrop__img lunar-backdrop__img--terrain" : "lunar-backdrop__img lunar-backdrop__img--disc"}
        loading="lazy"
        decoding="async"
      />
      {!isTerrain ? <div className="lunar-backdrop__glow" /> : null}
    </div>
  );
}

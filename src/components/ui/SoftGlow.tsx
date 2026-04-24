/**
 * SoftGlow
 *
 * Replacement for expensive `blur-[Npx]` filter-blob divs used as decorative
 * glow halos on marketing pages. Uses a pre-blurred radial-gradient on a
 * positioned layer so there is no `filter: blur()` cost at paint time.
 *
 * Default behaviour:
 *   - Hidden on mobile (< md breakpoint) to keep initial paint cheap
 *   - Single translucent radial-gradient on desktop
 *   - `pointer-events-none` so it never blocks interaction
 *
 * Tailwind `brand-*` color tokens (navy/purple/pink/orange) are mapped to
 * their CSS variables in `tailwind.config.ts`.
 */

import { CSSProperties } from 'react';

type GlowColor = 'purple' | 'pink' | 'orange' | 'navy';

type GlowProps = {
  /** Which brand colour this glow should use. */
  color?: GlowColor;
  /**
   * Absolute positioning classes (e.g. `-left-20 top-0`). Keep positioning
   * declarative so we can leave the SoftGlow root as `absolute inset-0`.
   */
  className?: string;
  /** CSS size for width/height, e.g. `400px` or `24rem`. */
  size?: string;
  /** Final alpha at the brightest point of the glow (0..1). */
  intensity?: number;
  /** Render on mobile too. Default `false` (only rendered at md+). */
  showOnMobile?: boolean;
};

const COLOR_RGB: Record<GlowColor, string> = {
  purple: '168 85 247',
  pink: '236 72 153',
  orange: '249 115 22',
  navy: '30 41 59',
};

export function SoftGlow({
  color = 'purple',
  className = '',
  size = '400px',
  intensity = 0.18,
  showOnMobile = false,
}: GlowProps) {
  const visibility = showOnMobile ? '' : 'hidden md:block';
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `radial-gradient(closest-side, rgb(${COLOR_RGB[color]} / ${intensity}), rgb(${COLOR_RGB[color]} / 0))`,
  };
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${visibility} ${className}`}
      style={style}
    />
  );
}

export default SoftGlow;

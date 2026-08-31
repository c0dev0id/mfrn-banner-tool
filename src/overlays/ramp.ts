import { RAMP_LENGTH } from '../config/overlay';
import { clamp } from '../util/math';

export interface RampStop {
  offset: number;
  /** Effect strength at this offset: 1 = full, 0 = clear. */
  alpha: number;
}

/**
 * Eased falloff along the ramp. A straight linear fade reads as a visible hard
 * wedge across the image; this is a smoothstep-ish curve that lands softly at
 * both ends.
 */
export function rampStops(): RampStop[] {
  return [
    { offset: 0, alpha: 1 },
    { offset: 0.25, alpha: 0.85 },
    { offset: 0.5, alpha: 0.55 },
    { offset: 0.75, alpha: 0.22 },
    { offset: 1, alpha: 0 },
  ];
}

/** Strength of the ramp at a normalised position along its axis. */
export function rampAlphaAt(t: number): number {
  const stops = rampStops();
  const x = clamp(t, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (x <= b.offset) {
      const span = b.offset - a.offset;
      const k = span === 0 ? 0 : (x - a.offset) / span;
      return a.alpha + (b.alpha - a.alpha) * k;
    }
  }
  return 0;
}

/**
 * Gradient along the top-left -> bottom-right axis, ending at RAMP_LENGTH of the
 * diagonal. Canvas clamps offsets past the end point to the final stop, so
 * everything beyond the ramp gets the fully-clear value for free.
 */
export function rampGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: (alpha: number) => string,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, width * RAMP_LENGTH, height * RAMP_LENGTH);
  for (const { offset, alpha } of rampStops()) g.addColorStop(offset, color(alpha));
  return g;
}

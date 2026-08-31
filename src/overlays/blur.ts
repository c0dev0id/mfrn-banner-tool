import type { Rect, Size } from '../crop/geometry';
import { clamp } from '../util/math';
import { rampAlphaAt, type RampStop } from './ramp';

export interface BlurLevel {
  /** Blur radius in output pixels. */
  radius: number;
  /** How much this level contributes, sampled along the ramp axis. */
  stops: RampStop[];
}

/** Resolution of the sampled mask curve. 16 bands is well past visible banding. */
const MASK_SAMPLES = 16;

/**
 * The blur pyramid.
 *
 * Radii are geometric (r/8, r/4, r/2, r) because perceived blur scales with the
 * log of the radius, so geometric steps look evenly spaced where linear ones
 * bunch up at the top.
 *
 * Each level's contribution is `(strength - previousRadius) / (thisRadius -
 * previousRadius)`, clamped. Drawn in increasing radius order, that makes every
 * point a blend of only the two levels bracketing it — so each cross-fade spans
 * one small radius step instead of the whole range, which is what keeps the
 * ghosting of a naive single blurred layer from appearing.
 *
 * `count` of 1 collapses to exactly that naive single-layer version, which is
 * useful for demonstrating the difference.
 */
export function blurLevels(maxRadius: number, count: number): BlurLevel[] {
  const n = Math.max(1, count - 1);
  const levels: BlurLevel[] = [];

  for (let i = 0; i < n; i++) {
    const hi = Math.pow(2, i - (n - 1));
    const lo = i === 0 ? 0 : Math.pow(2, i - 1 - (n - 1));
    const stops: RampStop[] = [];
    for (let s = 0; s <= MASK_SAMPLES; s++) {
      const t = s / MASK_SAMPLES;
      stops.push({ offset: t, alpha: clamp((rampAlphaAt(t) - lo) / (hi - lo), 0, 1) });
    }
    levels.push({ radius: maxRadius * hi, stops });
  }

  return levels;
}

/**
 * Scale factor for the blur working canvas. The output is blurry by definition,
 * so rendering it smaller and upscaling costs nothing visually. Never upscales.
 */
export function workingScale(out: Size, cap: number): number {
  const longEdge = Math.max(out.width, out.height);
  return longEdge > cap ? cap / longEdge : 1;
}

export interface PaddedSample {
  /** Region of the source bitmap to read, clamped to its bounds. */
  src: Rect;
  /** Where that region lands in the padded working canvas. */
  dest: Rect;
}

/**
 * Expand the crop so a blur has real pixels to sample beyond the frame edge.
 *
 * Canvas blur reads transparent black outside the source, which paints a dark
 * halo around the result. Reading a larger region of the *original* avoids it.
 * Where the crop already sits flush against the image edge there is nothing to
 * borrow, so the rect is clamped and the dest shrinks to match.
 */
export function paddedSampleRect(
  crop: Rect,
  work: Size,
  source: Size,
  pad: number,
): PaddedSample {
  const scaleX = work.width / Math.max(crop.w, 1e-6);
  const scaleY = work.height / Math.max(crop.h, 1e-6);
  const padSrcX = pad / scaleX;
  const padSrcY = pad / scaleY;

  // The unclamped window we would like, in source pixels.
  const wantX = crop.x - padSrcX;
  const wantY = crop.y - padSrcY;

  const x0 = clamp(wantX, 0, source.width);
  const y0 = clamp(wantY, 0, source.height);
  const x1 = clamp(crop.x + crop.w + padSrcX, 0, source.width);
  const y1 = clamp(crop.y + crop.h + padSrcY, 0, source.height);

  return {
    src: { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) },
    dest: {
      x: (x0 - wantX) * scaleX,
      y: (y0 - wantY) * scaleY,
      w: (x1 - x0) * scaleX,
      h: (y1 - y0) * scaleY,
    },
  };
}

/** Padding needed around a blur of this radius, in working pixels. */
export function blurPadding(radiusWork: number): number {
  return Math.ceil(radiusWork * 3);
}

let filterSupport: boolean | null = null;

/** Canvas filter needs Safari 16.4+; without it we fall back to scrim only. */
export function supportsCanvasFilter(): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return (filterSupport = false);
    ctx.filter = 'blur(1px)';
    filterSupport = ctx.filter !== 'none' && ctx.filter !== '';
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

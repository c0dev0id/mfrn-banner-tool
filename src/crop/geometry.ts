/**
 * Pure crop maths. No DOM, no canvas — everything here is unit-testable.
 *
 * Coordinate systems:
 *  - "image" coordinates: pixels of the decoded source bitmap. The crop rect
 *    lives here, so panning and zooming the viewport can never disturb a crop
 *    the user already set.
 *  - "view" coordinates: CSS pixels inside the cropper viewport.
 *
 * The View transform maps image -> view:  vx = ix * scale + tx
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface View {
  scale: number;
  tx: number;
  ty: number;
}

export interface Point {
  x: number;
  y: number;
}

import { clamp } from '../util/math';

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 32;
/** Smallest crop the user can drag, in image px. */
export const MIN_CROP = 8;

export { clamp } from '../util/math';

export function imageToView(p: Point, view: View): Point {
  return { x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty };
}

export function viewToImage(p: Point, view: View): Point {
  return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
}

export function rectToView(r: Rect, view: View): Rect {
  const { x, y } = imageToView(r, view);
  return { x, y, w: r.w * view.scale, h: r.h * view.scale };
}

/** Scale + centre so the whole image sits inside the viewport with padding. */
export function fitView(image: Size, viewport: Size, padding = 24): View {
  const availW = Math.max(1, viewport.width - padding * 2);
  const availH = Math.max(1, viewport.height - padding * 2);
  const scale = clamp(Math.min(availW / image.width, availH / image.height), MIN_SCALE, MAX_SCALE);
  return {
    scale,
    tx: (viewport.width - image.width * scale) / 2,
    ty: (viewport.height - image.height * scale) / 2,
  };
}

/**
 * Zoom by `factor` while keeping the image point currently under `anchor`
 * (a view-space point, e.g. the cursor) pinned in place.
 */
export function zoomAt(view: View, factor: number, anchor: Point): View {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const applied = scale / view.scale;
  return {
    scale,
    tx: anchor.x - (anchor.x - view.tx) * applied,
    ty: anchor.y - (anchor.y - view.ty) * applied,
  };
}

/** Zoom to an absolute scale (e.g. the 100% button) about `anchor`. */
export function zoomTo(view: View, targetScale: number, anchor: Point): View {
  return zoomAt(view, targetScale / view.scale, anchor);
}

export function panView(view: View, dx: number, dy: number): View {
  return { scale: view.scale, tx: view.tx + dx, ty: view.ty + dy };
}

/** Slide (never shrink) the rect back inside the image bounds. */
export function clampRectToImage(r: Rect, image: Size): Rect {
  const w = Math.min(r.w, image.width);
  const h = Math.min(r.h, image.height);
  return {
    w,
    h,
    x: clamp(r.x, 0, image.width - w),
    y: clamp(r.y, 0, image.height - h),
  };
}

/** Resolve a CropMode.aspect against the source image. */
export function resolveAspect(aspect: null | 'source' | number, image: Size): number | null {
  if (aspect === null) return null;
  if (aspect === 'source') return image.width / image.height;
  return aspect;
}

/** Largest rect of `aspect` centred inside `bounds`. */
export function fitAspectInside(bounds: Rect, aspect: number): Rect {
  const w = Math.min(bounds.w, bounds.h * aspect);
  const h = w / aspect;
  return { x: bounds.x + (bounds.w - w) / 2, y: bounds.y + (bounds.h - h) / 2, w, h };
}

/**
 * Re-fit an existing crop to a new aspect, keeping its centre where the user
 * put it. Grows to the largest rect of that aspect that still fits the image.
 */
export function retargetAspect(current: Rect, aspect: number | null, image: Size): Rect {
  if (aspect === null) return clampRectToImage(current, image);

  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;

  // Keep the crop's rough framing, but never exceed the pixels available on
  // either axis.
  const w = Math.min(Math.max(current.w, current.h * aspect), image.width, image.height * aspect);
  const h = w / aspect;
  return clampRectToImage({ x: cx - w / 2, y: cy - h / 2, w, h }, image);
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Drag `handle` to image-space point `p`.
 *
 * With an aspect lock the free axis follows the dragged one, anchored on the
 * opposite corner (or the rect centre for the four edge handles). The result is
 * always clamped inside the image, which is what stops exports from picking up
 * transparent edges.
 */
export function resizeRect(
  rect: Rect,
  handle: Handle,
  p: Point,
  aspect: number | null,
  image: Size,
): Rect {
  // The compass letters are disjoint, so the handle name is the edge set.
  const left = handle.includes('w');
  const right = handle.includes('e');
  const top = handle.includes('n');
  const bottom = handle.includes('s');

  const px = clamp(p.x, 0, image.width);
  const py = clamp(p.y, 0, image.height);

  let { x, y, w, h } = rect;
  const anchorRight = x + w;
  const anchorBottom = y + h;

  if (left) {
    x = Math.min(px, anchorRight - MIN_CROP);
    w = anchorRight - x;
  } else if (right) {
    w = Math.max(MIN_CROP, px - x);
  }

  if (top) {
    y = Math.min(py, anchorBottom - MIN_CROP);
    h = anchorBottom - y;
  } else if (bottom) {
    h = Math.max(MIN_CROP, py - y);
  }

  if (aspect !== null) {
    if (!top && !bottom) {
      // East/west edge: grow vertically about the rect's centre.
      const cy = rect.y + rect.h / 2;
      h = w / aspect;
      y = cy - h / 2;
    } else if (!left && !right) {
      // North/south edge: grow horizontally about the rect's centre.
      const cx = rect.x + rect.w / 2;
      w = h * aspect;
      x = cx - w / 2;
    } else {
      // Corner: let the larger of the two deltas drive, so the corner tracks
      // the pointer rather than lagging on one axis.
      if (w / aspect >= h) h = w / aspect;
      else w = h * aspect;
      if (left) x = anchorRight - w;
      if (top) y = anchorBottom - h;
    }

    // Shrink to fit rather than letting the lock push us off-image, holding
    // whichever corner the drag anchored on.
    const fit = Math.min(1, image.width / Math.max(w, 1e-6), image.height / Math.max(h, 1e-6));
    if (fit < 1) {
      if (left) x += w - w * fit;
      if (top) y += h - h * fit;
      w *= fit;
      h *= fit;
    }
  }

  return clampRectToImage({ x, y, w: Math.max(MIN_CROP, w), h: Math.max(MIN_CROP, h) }, image);
}

export function moveRect(rect: Rect, dx: number, dy: number, image: Size): Rect {
  return clampRectToImage({ ...rect, x: rect.x + dx, y: rect.y + dy }, image);
}

/**
 * Output pixel size for a crop.
 *  - fixed presets always export their declared size
 *  - Original/Freeform default to the crop's native pixels, unless the user
 *    typed an explicit size
 */
export function outputSizeFor(
  presetSize: Size | undefined,
  crop: Rect,
  manual?: Size | null,
): Size {
  if (presetSize) return presetSize;
  if (manual && manual.width > 0 && manual.height > 0) {
    return { width: Math.round(manual.width), height: Math.round(manual.height) };
  }
  return { width: Math.max(1, Math.round(crop.w)), height: Math.max(1, Math.round(crop.h)) };
}

/**
 * Aspect-locked manual output size: the user types one axis, the other follows
 * the crop's ratio. Returns null for a cleared or nonsensical input, meaning
 * "fall back to the crop's native pixels".
 */
export function sizeFromAxis(
  axis: 'width' | 'height',
  value: number,
  crop: Rect,
): Size | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const ratio = crop.w / Math.max(crop.h, 1e-6);
  return axis === 'width'
    ? { width: Math.round(value), height: Math.max(1, Math.round(value / ratio)) }
    : { width: Math.max(1, Math.round(value * ratio)), height: Math.round(value) };
}

/** >1 means the export stretches the selection; <=1 means it downsamples. */
export function upscaleFactor(crop: Rect, out: Size): number {
  return Math.max(out.width / Math.max(crop.w, 1e-6), out.height / Math.max(crop.h, 1e-6));
}

/** 1% slack so a rounding-error 1.0001 doesn't nag the user. */
export const UPSCALE_THRESHOLD = 1.01;

export function needsUpscale(crop: Rect, out: Size): boolean {
  return upscaleFactor(crop, out) > UPSCALE_THRESHOLD;
}

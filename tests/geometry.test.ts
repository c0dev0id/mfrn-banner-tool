import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_CROP,
  clampRectToImage,
  fitAspectInside,
  fitView,
  imageToView,
  moveRect,
  needsUpscale,
  outputSizeFor,
  resizeRect,
  resolveAspect,
  retargetAspect,
  upscaleFactor,
  viewToImage,
  zoomAt,
  type Rect,
  type Size,
} from '../src/crop/geometry';

const IMAGE: Size = { width: 4000, height: 3000 };

describe('view transform', () => {
  it('round-trips image <-> view', () => {
    const view = { scale: 0.37, tx: 12, ty: -8 };
    const p = { x: 913, y: 271 };
    const back = viewToImage(imageToView(p, view), view);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
  });

  it('fits the whole image inside the viewport with padding', () => {
    const view = fitView(IMAGE, { width: 800, height: 600 }, 24);
    expect(IMAGE.width * view.scale).toBeLessThanOrEqual(800 - 48 + 1e-9);
    expect(IMAGE.height * view.scale).toBeLessThanOrEqual(600 - 48 + 1e-9);
  });

  it('keeps the anchor point pinned while zooming', () => {
    const view = { scale: 0.5, tx: 40, ty: 20 };
    const anchor = { x: 300, y: 180 };
    const before = viewToImage(anchor, view);
    const after = viewToImage(anchor, zoomAt(view, 2.5, anchor));
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps zoom to the allowed range', () => {
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 1e6, { x: 0, y: 0 }).scale).toBe(MAX_SCALE);
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 1e-9, { x: 0, y: 0 }).scale).toBeGreaterThan(0);
  });

  it('allows zooming past 1:1 so small images can be inspected', () => {
    expect(zoomAt({ scale: 1, tx: 0, ty: 0 }, 8, { x: 0, y: 0 }).scale).toBe(8);
  });
});

describe('rect clamping', () => {
  it('slides a rect back inside the image without shrinking it', () => {
    const r = clampRectToImage({ x: -50, y: -50, w: 400, h: 300 }, IMAGE);
    expect(r).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  it('shrinks a rect larger than the image', () => {
    const r = clampRectToImage({ x: 0, y: 0, w: 9000, h: 9000 }, IMAGE);
    expect(r.w).toBe(IMAGE.width);
    expect(r.h).toBe(IMAGE.height);
  });

  it('keeps moves inside the bounds', () => {
    const r = moveRect({ x: 3800, y: 0, w: 200, h: 200 }, 500, 0, IMAGE);
    expect(r.x + r.w).toBeLessThanOrEqual(IMAGE.width);
  });
});

describe('aspect handling', () => {
  it('resolves source aspect from the image', () => {
    expect(resolveAspect('source', IMAGE)).toBeCloseTo(4 / 3);
    expect(resolveAspect(null, IMAGE)).toBeNull();
    expect(resolveAspect(5.6, IMAGE)).toBe(5.6);
  });

  it('fits a wide aspect inside a square bound', () => {
    const r = fitAspectInside({ x: 0, y: 0, w: 100, h: 100 }, 5.6);
    expect(r.w / r.h).toBeCloseTo(5.6);
    expect(r.w).toBeLessThanOrEqual(100);
    expect(r.h).toBeLessThanOrEqual(100);
  });

  it('retargets a crop to a new aspect keeping it inside the image', () => {
    const start: Rect = { x: 1000, y: 900, w: 800, h: 800 };
    const r = retargetAspect(start, 1400 / 250, IMAGE);
    expect(r.w / r.h).toBeCloseTo(1400 / 250, 5);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(IMAGE.width + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(IMAGE.height + 1e-9);
  });

  it('retargeting a very wide aspect on a tall image still fits', () => {
    const tall: Size = { width: 600, height: 4000 };
    const r = retargetAspect({ x: 0, y: 1000, w: 600, h: 600 }, 1400 / 250, tall);
    expect(r.w).toBeLessThanOrEqual(tall.width + 1e-9);
    expect(r.w / r.h).toBeCloseTo(1400 / 250, 5);
  });
});

describe('resizeRect', () => {
  const rect: Rect = { x: 1000, y: 1000, w: 800, h: 600 };

  it('drags the SE corner freely when unlocked', () => {
    const r = resizeRect(rect, 'se', { x: 2000, y: 1900 }, null, IMAGE);
    expect(r.w).toBeCloseTo(1000);
    expect(r.h).toBeCloseTo(900);
  });

  it('keeps the NW corner anchored when dragging SE', () => {
    const r = resizeRect(rect, 'se', { x: 2500, y: 2200 }, null, IMAGE);
    expect(r.x).toBeCloseTo(1000);
    expect(r.y).toBeCloseTo(1000);
  });

  it('keeps the SE corner anchored when dragging NW', () => {
    const r = resizeRect(rect, 'nw', { x: 500, y: 400 }, null, IMAGE);
    expect(r.x + r.w).toBeCloseTo(1800);
    expect(r.y + r.h).toBeCloseTo(1600);
  });

  it('holds the aspect ratio on a corner drag', () => {
    const r = resizeRect(rect, 'se', { x: 2600, y: 1300 }, 1, IMAGE);
    expect(r.w).toBeCloseTo(r.h, 5);
  });

  it('holds the aspect ratio on an edge drag and keeps the rect centred', () => {
    const cy = rect.y + rect.h / 2;
    const r = resizeRect(rect, 'e', { x: 2400, y: 1300 }, 2, IMAGE);
    expect(r.w / r.h).toBeCloseTo(2, 5);
    expect(r.y + r.h / 2).toBeCloseTo(cy, 5);
  });

  it('never resizes below the minimum', () => {
    const r = resizeRect(rect, 'se', { x: 1000, y: 1000 }, null, IMAGE);
    expect(r.w).toBeGreaterThanOrEqual(MIN_CROP);
    expect(r.h).toBeGreaterThanOrEqual(MIN_CROP);
  });

  it('stays inside the image when an aspect lock would push it out', () => {
    const r = resizeRect({ x: 0, y: 2900, w: 100, h: 100 }, 'se', { x: 4000, y: 3000 }, 1, IMAGE);
    expect(r.x + r.w).toBeLessThanOrEqual(IMAGE.width + 1e-6);
    expect(r.y + r.h).toBeLessThanOrEqual(IMAGE.height + 1e-6);
    expect(r.w / r.h).toBeCloseTo(1, 5);
  });
});

describe('output size and upscale detection', () => {
  const crop: Rect = { x: 0, y: 0, w: 900, h: 161 };

  it('uses the preset size when there is one', () => {
    expect(outputSizeFor({ width: 1400, height: 250 }, crop)).toEqual({ width: 1400, height: 250 });
  });

  it('falls back to native crop pixels', () => {
    expect(outputSizeFor(undefined, crop)).toEqual({ width: 900, height: 161 });
  });

  it('honours an explicit manual size', () => {
    expect(outputSizeFor(undefined, crop, { width: 1800, height: 322 })).toEqual({
      width: 1800,
      height: 322,
    });
  });

  it('ignores a zero or negative manual size', () => {
    expect(outputSizeFor(undefined, crop, { width: 0, height: 0 })).toEqual({
      width: 900,
      height: 161,
    });
  });

  it('flags upscaling against a larger target', () => {
    expect(needsUpscale(crop, { width: 1400, height: 250 })).toBe(true);
    expect(upscaleFactor(crop, { width: 1400, height: 250 })).toBeCloseTo(1400 / 900, 3);
  });

  it('does not flag a downscale', () => {
    expect(needsUpscale({ x: 0, y: 0, w: 2800, h: 500 }, { width: 1400, height: 250 })).toBe(false);
  });

  it('does not nag on a rounding-error match', () => {
    expect(needsUpscale({ x: 0, y: 0, w: 1399.9, h: 249.98 }, { width: 1400, height: 250 })).toBe(
      false,
    );
  });

  it('native-size exports are never upscales', () => {
    const out = outputSizeFor(undefined, crop);
    expect(needsUpscale(crop, out)).toBe(false);
  });
});

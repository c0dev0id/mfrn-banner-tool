import { describe, expect, it } from 'vitest';
import { CROP_MODES, aspectOf, modeById, presetSizeOf } from '../src/config/presets';
import { resolveAspect, sizeFromAxis, zoomTo } from '../src/crop/geometry';

describe('crop modes', () => {
  it('reports a fixed size only for the preset modes', () => {
    expect(presetSizeOf(modeById('banner'))).toEqual({ width: 1400, height: 250 });
    expect(presetSizeOf(modeById('original'))).toBeUndefined();
    expect(presetSizeOf(modeById('free'))).toBeUndefined();
  });

  it('derives a preset aspect from its size instead of restating it', () => {
    for (const mode of CROP_MODES) {
      const size = presetSizeOf(mode);
      if (!size) continue;
      expect(mode.aspect).toBeUndefined();
      expect(aspectOf(mode)).toBeCloseTo(size.width / size.height, 10);
    }
  });

  it('keeps the two free modes' + " aspects", () => {
    expect(aspectOf(modeById('original'))).toBe('source');
    expect(aspectOf(modeById('free'))).toBeNull();
  });

  it('resolves the source aspect against the uploaded image', () => {
    const image = { width: 4000, height: 3000 };
    expect(resolveAspect(aspectOf(modeById('original')), image)).toBeCloseTo(4 / 3);
    expect(resolveAspect(aspectOf(modeById('avatar')), image)).toBe(1);
  });

  it('falls back to the first mode for an unknown id', () => {
    expect(modeById('nope').id).toBe(CROP_MODES[0]!.id);
  });
});

describe('sizeFromAxis', () => {
  const crop = { x: 0, y: 0, w: 900, h: 300 };

  it('derives height from width at the crop ratio', () => {
    expect(sizeFromAxis('width', 1200, crop)).toEqual({ width: 1200, height: 400 });
  });

  it('derives width from height at the crop ratio', () => {
    expect(sizeFromAxis('height', 100, crop)).toEqual({ width: 300, height: 100 });
  });

  it('returns null for cleared or nonsensical input', () => {
    expect(sizeFromAxis('width', NaN, crop)).toBeNull();
    expect(sizeFromAxis('width', 0, crop)).toBeNull();
    expect(sizeFromAxis('height', -5, crop)).toBeNull();
  });

  it('never derives a zero-pixel axis', () => {
    const wide = { x: 0, y: 0, w: 4000, h: 10 };
    expect(sizeFromAxis('height', 1, wide)!.width).toBeGreaterThanOrEqual(1);
    expect(sizeFromAxis('width', 1, wide)!.height).toBeGreaterThanOrEqual(1);
  });
});

describe('zoomTo', () => {
  const anchor = { x: 200, y: 120 };

  it('reaches the requested absolute scale', () => {
    expect(zoomTo({ scale: 0.37, tx: 10, ty: 4 }, 1, anchor).scale).toBeCloseTo(1, 10);
  });

  it('clamps rather than applying the bound to the ratio', () => {
    const out = zoomTo({ scale: 0.5, tx: 0, ty: 0 }, 1e6, anchor);
    expect(out.scale).toBe(32);
  });

  it('keeps the anchor pinned', () => {
    const view = { scale: 0.25, tx: 33, ty: -7 };
    const zoomed = zoomTo(view, 3, anchor);
    expect((anchor.x - zoomed.tx) / zoomed.scale).toBeCloseTo((anchor.x - view.tx) / view.scale, 6);
  });
});

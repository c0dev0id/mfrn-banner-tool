import { describe, expect, it } from 'vitest';
import { blurLevels, blurPadding, paddedSampleRect, workingScale } from '../src/overlays/blur';
import { rampAlphaAt, rampStops } from '../src/overlays/ramp';

describe('ramp', () => {
  it('starts at full strength and ends clear', () => {
    const stops = rampStops();
    expect(stops[0]).toEqual({ offset: 0, alpha: 1 });
    expect(stops.at(-1)).toEqual({ offset: 1, alpha: 0 });
  });

  it('falls off monotonically', () => {
    const stops = rampStops();
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]!.offset).toBeGreaterThan(stops[i - 1]!.offset);
      expect(stops[i]!.alpha).toBeLessThan(stops[i - 1]!.alpha);
    }
  });

  it('interpolates between stops and clamps outside the ramp', () => {
    expect(rampAlphaAt(0)).toBe(1);
    expect(rampAlphaAt(1)).toBe(0);
    expect(rampAlphaAt(-5)).toBe(1);
    expect(rampAlphaAt(9)).toBe(0);
    expect(rampAlphaAt(0.125)).toBeCloseTo(0.925, 6);
  });

  it('eases rather than running linear', () => {
    // A straight line would put the midpoint at 0.5; the eased curve must not.
    expect(rampAlphaAt(0.5)).not.toBeCloseTo(0.5, 2);
  });
});

describe('blurLevels', () => {
  const levels = blurLevels(32, 5);

  it('produces one fewer level than the count, since the base is already sharp', () => {
    expect(levels).toHaveLength(4);
  });

  it('spaces radii geometrically up to the maximum', () => {
    expect(levels.map((l) => l.radius)).toEqual([4, 8, 16, 32]);
  });

  it('is fully opaque at the corner only for the largest radius', () => {
    const atCorner = (i: number) => levels[i]!.stops[0]!.alpha;
    expect(atCorner(3)).toBe(1);
    for (const level of levels) expect(atCorner(levels.indexOf(level))).toBeGreaterThan(0);
  });

  it('clears every level by the end of the ramp', () => {
    for (const level of levels) expect(level.stops.at(-1)!.alpha).toBe(0);
  });

  it('never lets a level increase in strength along the ramp', () => {
    for (const level of levels) {
      for (let i = 1; i < level.stops.length; i++) {
        expect(level.stops[i]!.alpha).toBeLessThanOrEqual(level.stops[i - 1]!.alpha + 1e-9);
      }
    }
  });

  it('blends at most two adjacent levels at any point', () => {
    // The whole reason for the pyramid: each cross-fade must span one radius
    // step, not the full range.
    for (const stop of levels[0]!.stops.keys()) {
      const partial = levels.filter((l) => {
        const a = l.stops[stop]!.alpha;
        return a > 0.001 && a < 0.999;
      });
      expect(partial.length).toBeLessThanOrEqual(1);
    }
  });

  it('collapses to the naive single blurred layer at count 1', () => {
    const single = blurLevels(32, 1);
    expect(single).toHaveLength(1);
    expect(single[0]!.radius).toBe(32);
    // Its mask is the raw ramp — blending radius 0 against radius max directly.
    expect(single[0]!.stops[0]!.alpha).toBe(1);
    expect(single[0]!.stops.at(-1)!.alpha).toBe(0);
  });
});

describe('workingScale', () => {
  it('leaves small outputs alone', () => {
    expect(workingScale({ width: 1400, height: 250 }, 1400)).toBe(1);
    expect(workingScale({ width: 256, height: 256 }, 1400)).toBe(1);
  });

  it('caps the long edge and never upscales', () => {
    const scale = workingScale({ width: 6000, height: 4000 }, 1400);
    expect(scale).toBeCloseTo(1400 / 6000, 10);
    expect(6000 * scale).toBeCloseTo(1400, 6);
    expect(scale).toBeLessThan(1);
  });
});

describe('paddedSampleRect', () => {
  const source = { width: 4000, height: 3000 };
  const work = { width: 1000, height: 500 };

  it('reads beyond the crop when the image allows it', () => {
    const crop = { x: 1000, y: 1000, w: 2000, h: 1000 };
    const { src } = paddedSampleRect(crop, work, source, 30);
    expect(src.x).toBeLessThan(crop.x);
    expect(src.y).toBeLessThan(crop.y);
    expect(src.w).toBeGreaterThan(crop.w);
    expect(src.h).toBeGreaterThan(crop.h);
  });

  it('never samples outside the bitmap', () => {
    for (const crop of [
      { x: 0, y: 0, w: 500, h: 250 },
      { x: 3500, y: 2750, w: 500, h: 250 },
      { x: 0, y: 0, w: 4000, h: 3000 },
    ]) {
      const { src } = paddedSampleRect(crop, work, source, 60);
      expect(src.x).toBeGreaterThanOrEqual(0);
      expect(src.y).toBeGreaterThanOrEqual(0);
      expect(src.x + src.w).toBeLessThanOrEqual(source.width + 1e-9);
      expect(src.y + src.h).toBeLessThanOrEqual(source.height + 1e-9);
    }
  });

  it('shrinks the destination to match a clamped source, keeping the mapping true', () => {
    // Crop flush against the top-left: there is nothing to borrow that side.
    const crop = { x: 0, y: 0, w: 2000, h: 1000 };
    const { src, dest } = paddedSampleRect(crop, work, source, 40);
    expect(src.x).toBe(0);
    expect(dest.x).toBeCloseTo(40, 6); // padding stays empty rather than stretching
    const scaleX = work.width / crop.w;
    expect(dest.w).toBeCloseTo(src.w * scaleX, 6);
    expect(dest.h).toBeCloseTo(src.h * (work.height / crop.h), 6);
  });

  it('places the crop itself at the padding offset when fully padded', () => {
    const crop = { x: 1000, y: 1000, w: 2000, h: 1000 };
    const pad = 25;
    const { dest } = paddedSampleRect(crop, work, source, pad);
    expect(dest.x).toBeCloseTo(0, 6);
    expect(dest.w).toBeCloseTo(work.width + pad * 2, 6);
  });
});

describe('blurPadding', () => {
  it('scales with the radius so the blur has real pixels to reach for', () => {
    expect(blurPadding(10)).toBe(30);
    expect(blurPadding(0)).toBe(0);
    expect(Number.isInteger(blurPadding(3.3))).toBe(true);
  });
});

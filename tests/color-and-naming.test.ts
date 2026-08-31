import { describe, expect, it } from 'vitest';
import { averageRGBA, rgbaString } from '../src/image/averageColor';
import { exportFilename, slugify } from '../src/export/png';

const pixels = (...rgba: number[][]) =>
  new Uint8ClampedArray(rgba.flat());

describe('averageRGBA', () => {
  it('returns the colour itself for a flat image', () => {
    expect(averageRGBA(pixels([12, 34, 56, 255], [12, 34, 56, 255]))).toEqual({
      r: 12,
      g: 34,
      b: 56,
    });
  });

  it('averages in linear light rather than plain sRGB', () => {
    // A plain byte mean of black and white is 128; RMS keeps it brighter,
    // which is what stops mixed images turning to mud.
    const avg = averageRGBA(pixels([0, 0, 0, 255], [255, 255, 255, 255]));
    expect(avg.r).toBeGreaterThan(150);
    expect(avg.r).toEqual(avg.g);
  });

  it('ignores fully transparent pixels', () => {
    expect(averageRGBA(pixels([255, 0, 0, 0], [0, 0, 255, 255]))).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('does not divide by zero on a fully transparent input', () => {
    expect(averageRGBA(pixels([9, 9, 9, 0]))).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('formats an rgba string', () => {
    expect(rgbaString({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)');
  });
});

describe('filenames', () => {
  it('slugifies a messy name', () => {
    expect(slugify('Sunset Ride!!.JPG')).toBe('sunset-ride');
  });

  it('strips accents rather than dropping the word', () => {
    expect(slugify('Pässe Über Alles.png')).toBe('passe-uber-alles');
  });

  it('falls back when nothing survives', () => {
    expect(slugify('***.png')).toBe('banner');
  });

  it('builds the export filename with the real dimensions', () => {
    expect(exportFilename('my photo.heic', 1400, 250)).toBe('my-photo-1400x250.png');
  });
});

import { describe, expect, it } from 'vitest';
import { computeMetrics, ellipsise, wrapLines } from '../src/render/text';

/** Deterministic stand-in for ctx.measureText: every glyph is 10px wide. */
const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('returns nothing for blank input', () => {
    expect(wrapLines('   ', 200, measure, 2)).toEqual([]);
  });

  it('keeps a short title on one line', () => {
    expect(wrapLines('Tracks', 200, measure, 2)).toEqual(['Tracks']);
  });

  it('wraps on words', () => {
    expect(wrapLines('one two three', 90, measure, 3)).toEqual(['one two', 'three']);
  });

  it('hard-breaks a single word wider than the line', () => {
    const lines = wrapLines('Donaudampfschifffahrt', 50, measure, 5);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(50);
  });

  it('ellipsises once past the line cap', () => {
    const lines = wrapLines('alpha bravo charlie delta echo foxtrot', 100, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    expect(measure(lines[1]!)).toBeLessThanOrEqual(100);
  });
});

describe('ellipsise', () => {
  it('leaves text that already fits alone', () => {
    expect(ellipsise('short', 200, measure)).toBe('short');
  });

  it('truncates and appends an ellipsis within the budget', () => {
    const out = ellipsise('a very long subtitle indeed', 100, measure);
    expect(out.endsWith('…')).toBe(true);
    expect(measure(out)).toBeLessThanOrEqual(100);
  });
});

describe('computeMetrics', () => {
  it('scales type with the output height', () => {
    const strip = computeMetrics(1400, 250, 1);
    const article = computeMetrics(1200, 686, 1);
    expect(article.titleSize).toBeGreaterThan(strip.titleSize);
  });

  it('applies the S/M/L multiplier', () => {
    expect(computeMetrics(1400, 250, 1.22).titleSize).toBeCloseTo(
      computeMetrics(1400, 250, 1).titleSize * 1.22,
      5,
    );
  });

  it('keeps a tiny avatar legible via the minimum sizes', () => {
    const m = computeMetrics(256, 256, 0.82);
    expect(m.titleSize).toBeGreaterThanOrEqual(13);
    expect(m.subtitleSize).toBeGreaterThanOrEqual(11);
    expect(m.marginX).toBeGreaterThanOrEqual(12);
  });

  it('never lets the text box exceed the frame', () => {
    const m = computeMetrics(1400, 250, 1);
    expect(m.maxTextWidth).toBe(1400 - m.marginX * 2);
  });
});

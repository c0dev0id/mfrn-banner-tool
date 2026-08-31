import { describe, expect, it } from 'vitest';
import { METRICS, SUBTITLE_COLOR, TITLE_COLOR } from '../src/config/style';
import { computeMetrics, layoutText, type TextMeasurer } from '../src/render/text';

/** Deterministic stand-in for canvas metrics: every glyph is 10px wide. */
const measurer: TextMeasurer = {
  width: (t) => t.length * 10,
  ascent: (_t, _f, size) => size * METRICS.ascentRatio,
};

const spec = (title: string, subtitle = '', scale = 1) => ({ title, subtitle, scale });
const W = 1400;
const H = 250;
const m = computeMetrics(W, H, 1);

describe('layoutText', () => {
  it('lays out nothing when both fields are blank', () => {
    expect(layoutText(W, H, spec('  ', '  '), measurer)).toEqual([]);
  });

  it('places a lone title at the left margin', () => {
    const [line] = layoutText(W, H, spec('Tracks'), measurer);
    expect(line!.text).toBe('Tracks');
    expect(line!.x).toBe(m.marginX);
    expect(line!.color).toBe(TITLE_COLOR);
  });

  it('anchors the block top at the vertical margin (TEXT_ANCHOR = top-left)', () => {
    const [line] = layoutText(W, H, spec('Tracks'), measurer);
    expect(line!.baseline).toBeCloseTo(m.marginY + m.titleSize * METRICS.ascentRatio, 6);
  });

  it('puts the subtitle below the title, in the accent colour', () => {
    const lines = layoutText(W, H, spec('Tracks', 'Information'), measurer);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.color).toBe(SUBTITLE_COLOR);
    expect(lines[1]!.baseline).toBeGreaterThan(lines[0]!.baseline);
  });

  it('separates title and subtitle by exactly the configured gap', () => {
    const lines = layoutText(W, H, spec('Tracks', 'Information'), measurer);
    const titleAscent = m.titleSize * METRICS.ascentRatio;
    const subtitleAscent = m.subtitleSize * METRICS.ascentRatio;
    expect(lines[1]!.baseline - lines[0]!.baseline).toBeCloseTo(
      m.lineGap + subtitleAscent - titleAscent + titleAscent,
      6,
    );
  });

  it('advances wrapped title lines by the title leading', () => {
    // 300 chars at 10px each cannot fit 1400px, so this wraps.
    const lines = layoutText(W, H, spec('word '.repeat(60).trim()), measurer);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]!.baseline - lines[0]!.baseline).toBeCloseTo(m.titleAdvance, 6);
  });

  it('pushes the subtitle down when the title wraps to two lines', () => {
    const one = layoutText(W, H, spec('Tracks', 'Information'), measurer);
    const two = layoutText(W, H, spec('word '.repeat(60).trim(), 'Information'), measurer);
    const subOne = one.at(-1)!;
    const subTwo = two.at(-1)!;
    expect(subTwo.baseline - subOne.baseline).toBeCloseTo(m.titleAdvance, 6);
  });

  it('anchors a lone subtitle at the same top as a lone title', () => {
    const [only] = layoutText(W, H, spec('', 'Information'), measurer);
    expect(only!.color).toBe(SUBTITLE_COLOR);
    expect(only!.baseline).toBeCloseTo(m.marginY + m.subtitleSize * METRICS.ascentRatio, 6);
  });

  it('never places text outside the frame', () => {
    for (const [w, h] of [[256, 256], [1400, 250], [1200, 686]] as const) {
      const lines = layoutText(w, h, spec('Tracks, Pässe, POIs', 'Information'), measurer);
      for (const line of lines) {
        expect(line.x).toBeGreaterThan(0);
        expect(line.baseline).toBeGreaterThan(0);
        expect(line.baseline).toBeLessThan(h);
        expect(line.x + measurer.width(line.text, line.font)).toBeLessThanOrEqual(w);
      }
    }
  });

  it('scales the whole block with the S/M/L multiplier', () => {
    const small = layoutText(W, H, spec('Tracks', 'Information', 0.82), measurer);
    const large = layoutText(W, H, spec('Tracks', 'Information', 1.22), measurer);
    expect(large[0]!.baseline).toBeGreaterThan(small[0]!.baseline);
    expect(large[1]!.baseline - large[0]!.baseline).toBeGreaterThan(
      small[1]!.baseline - small[0]!.baseline,
    );
  });
});

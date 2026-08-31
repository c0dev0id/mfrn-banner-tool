import {
  METRICS,
  SUBTITLE_COLOR,
  SUBTITLE_FONT,
  SUBTITLE_ITALIC,
  SUBTITLE_WEIGHT,
  TEXT_ANCHOR,
  TITLE_COLOR,
  TITLE_FONT,
  TITLE_WEIGHT,
  type TextAnchor,
} from '../config/style';

export interface TextSpec {
  title: string;
  subtitle: string;
  /** Multiplier from the S/M/L control. */
  scale: number;
}

export interface ResolvedTextMetrics {
  marginX: number;
  marginY: number;
  titleSize: number;
  subtitleSize: number;
  titleAdvance: number;
  lineGap: number;
  maxTextWidth: number;
  shadowBlur: number;
  shadowOffset: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * All type metrics derive from the output height, so a single house setting
 * holds up from a 256×256 avatar to a 1400×250 strip.
 */
export function computeMetrics(width: number, height: number, scale: number): ResolvedTextMetrics {
  const marginX = Math.max(METRICS.minMargin, Math.round(height * METRICS.marginX));
  const marginY = Math.max(METRICS.minMargin, Math.round(height * METRICS.marginY));
  const titleSize = clamp(height * METRICS.titleSize * scale, METRICS.titleMin, METRICS.titleMax);
  const subtitleSize = Math.max(METRICS.subtitleMin, titleSize * METRICS.subtitleRatio);
  return {
    marginX,
    marginY,
    titleSize,
    subtitleSize,
    titleAdvance: titleSize * METRICS.titleLeading,
    lineGap: titleSize * METRICS.lineGap,
    maxTextWidth: Math.max(1, width - marginX * 2),
    shadowBlur: height * METRICS.shadowBlur,
    shadowOffset: height * METRICS.shadowOffset,
  };
}

export type Measure = (text: string) => number;

/** Trim `line` until it plus an ellipsis fits `maxWidth`. */
export function ellipsise(line: string, maxWidth: number, measure: Measure): string {
  if (measure(line) <= maxWidth) return line;
  let out = line;
  while (out.length > 0 && measure(out + '…') > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + '…';
}

/**
 * Greedy word wrap, capped at `maxLines`. A single word wider than the line box
 * is hard-broken by character rather than left to overflow the frame.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: Measure,
  maxLines: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = '';
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    // Word alone is too wide: break it across lines by character.
    let chunk = '';
    for (const ch of word) {
      if (measure(chunk + ch) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    current = chunk;
  }
  pushCurrent();

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const overflowed = lines.slice(maxLines).join(' ');
  const last = kept[maxLines - 1]!;
  kept[maxLines - 1] = ellipsise(`${last} ${overflowed}`, maxWidth, measure);
  return kept;
}

export function titleFont(size: number): string {
  return `${TITLE_WEIGHT} ${size}px ${TITLE_FONT}`;
}

export function subtitleFont(size: number): string {
  return `${SUBTITLE_ITALIC ? 'italic ' : ''}${SUBTITLE_WEIGHT} ${size}px ${SUBTITLE_FONT}`;
}

/** One laid-out line, ready to paint. */
export interface PositionedLine {
  text: string;
  x: number;
  baseline: number;
  font: string;
  color: string;
}

/**
 * Text measurement, abstracted so layout can be computed and tested without a
 * canvas. The canvas implementation is `canvasMetrics` below.
 */
export interface TextMeasurer {
  width(text: string, font: string): number;
  ascent(text: string, font: string, size: number): number;
}

function blockTopFor(anchor: TextAnchor, height: number, blockHeight: number, marginY: number) {
  if (anchor === 'top-left') return marginY;
  if (anchor === 'bottom-left') return height - marginY - blockHeight;
  return (height - blockHeight) / 2;
}

/**
 * Pure placement: wraps, ellipsises and positions the title/subtitle block.
 *
 * Kept separate from painting so a new anchor or a third text element is a
 * change in one testable function rather than in a baseline accumulator that
 * has to stay in step with a block-height sum.
 */
export function layoutText(
  width: number,
  height: number,
  spec: TextSpec,
  measurer: TextMeasurer,
): PositionedLine[] {
  const title = spec.title.trim();
  const subtitle = spec.subtitle.trim();
  if (!title && !subtitle) return [];

  const m = computeMetrics(width, height, spec.scale);
  const tFont = titleFont(m.titleSize);
  const sFont = subtitleFont(m.subtitleSize);

  const titleLines = title
    ? wrapLines(title, m.maxTextWidth, (t) => measurer.width(t, tFont), METRICS.maxTitleLines)
    : [];
  const subtitleLine = subtitle
    ? ellipsise(subtitle, m.maxTextWidth, (t) => measurer.width(t, sFont))
    : '';

  const titleAscent = titleLines.length
    ? measurer.ascent(titleLines[0]!, tFont, m.titleSize)
    : 0;
  const subtitleAscent = subtitleLine ? measurer.ascent(subtitleLine, sFont, m.subtitleSize) : 0;

  // Three independent parts, so the block height and each baseline derive from
  // the same numbers instead of one being reverse-engineered from the other.
  const titleBlock = titleLines.length
    ? titleAscent + (titleLines.length - 1) * m.titleAdvance
    : 0;
  const gap = titleLines.length && subtitleLine ? m.lineGap : 0;
  const descent = (subtitleLine ? m.subtitleSize : m.titleSize) * METRICS.descentRatio;
  const blockHeight = titleBlock + gap + subtitleAscent + descent;

  const top = blockTopFor(TEXT_ANCHOR, height, blockHeight, m.marginY);

  const lines: PositionedLine[] = titleLines.map((text, i) => ({
    text,
    x: m.marginX,
    baseline: top + titleAscent + i * m.titleAdvance,
    font: tFont,
    color: TITLE_COLOR,
  }));

  if (subtitleLine) {
    lines.push({
      text: subtitleLine,
      x: m.marginX,
      baseline: top + titleBlock + gap + subtitleAscent,
      font: sFont,
      color: SUBTITLE_COLOR,
    });
  }

  return lines;
}

/** Measures against a real 2D context. Mutates ctx.font; call inside save(). */
export function canvasMetrics(ctx: CanvasRenderingContext2D): TextMeasurer {
  return {
    width(text, font) {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
    ascent(text, font, size) {
      ctx.font = font;
      const m = ctx.measureText(text || 'H');
      return m.actualBoundingBoxAscent || size * METRICS.ascentRatio;
    },
  };
}

/**
 * Paints the house title/subtitle block. Left-aligned, weights and colours
 * fixed by config/style.ts — deliberately not user-tunable.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: TextSpec,
): void {
  ctx.save();
  const lines = layoutText(width, height, spec, canvasMetrics(ctx));
  if (lines.length) {
    const m = computeMetrics(width, height, spec.scale);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = METRICS.shadowColor;
    ctx.shadowBlur = m.shadowBlur;
    ctx.shadowOffsetY = m.shadowOffset;
    for (const line of lines) {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, line.x, line.baseline);
    }
  }
  ctx.restore();
}

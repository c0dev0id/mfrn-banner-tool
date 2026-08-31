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

function ascentOf(ctx: CanvasRenderingContext2D, text: string, fallbackSize: number): number {
  const m = ctx.measureText(text || 'H');
  return m.actualBoundingBoxAscent || fallbackSize * 0.73;
}

function blockTopFor(anchor: TextAnchor, height: number, blockHeight: number, marginY: number) {
  if (anchor === 'top-left') return marginY;
  if (anchor === 'bottom-left') return height - marginY - blockHeight;
  return (height - blockHeight) / 2;
}

/**
 * Draws the house title/subtitle block. Left-aligned, weights and colours fixed
 * by config/style.ts — deliberately not user-tunable.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: TextSpec,
): void {
  const title = spec.title.trim();
  const subtitle = spec.subtitle.trim();
  if (!title && !subtitle) return;

  const m = computeMetrics(width, height, spec.scale);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = titleFont(m.titleSize);
  const titleLines = wrapLines(
    title,
    m.maxTextWidth,
    (t) => ctx.measureText(t).width,
    METRICS.maxTitleLines,
  );
  const titleAscent = titleLines.length ? ascentOf(ctx, titleLines[0]!, m.titleSize) : 0;

  ctx.font = subtitleFont(m.subtitleSize);
  const subtitleLine = subtitle
    ? ellipsise(subtitle, m.maxTextWidth, (t) => ctx.measureText(t).width)
    : '';
  const subtitleAscent = subtitleLine ? ascentOf(ctx, subtitleLine, m.subtitleSize) : 0;

  // Block height, so middle/bottom anchors have something to measure against.
  let blockHeight = 0;
  if (titleLines.length) blockHeight += titleAscent + (titleLines.length - 1) * m.titleAdvance;
  if (subtitleLine) {
    blockHeight += (titleLines.length ? m.lineGap : 0) + subtitleAscent + m.subtitleSize * 0.22;
  } else if (titleLines.length) {
    blockHeight += m.titleSize * 0.22;
  }

  let baseline = blockTopFor(TEXT_ANCHOR, height, blockHeight, m.marginY) + titleAscent;

  ctx.shadowColor = METRICS.shadowColor;
  ctx.shadowBlur = m.shadowBlur;
  ctx.shadowOffsetY = m.shadowOffset;

  ctx.font = titleFont(m.titleSize);
  ctx.fillStyle = TITLE_COLOR;
  for (const line of titleLines) {
    ctx.fillText(line, m.marginX, baseline);
    baseline += m.titleAdvance;
  }

  if (subtitleLine) {
    // Undo the trailing advance from the title loop, then apply the real gap.
    if (titleLines.length) baseline += m.lineGap - m.titleAdvance + subtitleAscent;
    else baseline = blockTopFor(TEXT_ANCHOR, height, blockHeight, m.marginY) + subtitleAscent;
    ctx.font = subtitleFont(m.subtitleSize);
    ctx.fillStyle = SUBTITLE_COLOR;
    ctx.fillText(subtitleLine, m.marginX, baseline);
  }

  ctx.restore();
}

/**
 * House style for generated banners.
 *
 * Typography and text placement are deliberately NOT user-facing controls:
 * fixing them here is what makes every generated banner recognisably ours.
 * Tuning the look means editing this file, nothing else.
 */

export type TextAnchor = 'top-left' | 'middle-left' | 'bottom-left';

/** Swap in the brand font by dropping woff2 files in public/fonts and adding
 *  the @font-face to styles.css, then putting the family name first here. */
export const TITLE_FONT = '"MFRN Display", "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const SUBTITLE_FONT = '"MFRN Display", "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const TITLE_WEIGHT = 900;
export const SUBTITLE_WEIGHT = 900;
export const SUBTITLE_ITALIC = true;

export const TITLE_COLOR = '#e9ecef';
export const SUBTITLE_COLOR = '#3b87d6';

export const TEXT_ANCHOR: TextAnchor = 'top-left';

/** All metrics are fractions of the output height, so one setting works from a
 *  256×256 avatar to a 1400×250 strip. */
export const METRICS = {
  marginX: 0.085,
  marginY: 0.085,
  minMargin: 12,
  titleSize: 0.16,
  titleMin: 13,
  titleMax: 190,
  /** Subtitle size as a fraction of the resolved title size. */
  subtitleRatio: 0.52,
  subtitleMin: 11,
  /** Gap between title baseline block and subtitle, as a fraction of title size. */
  lineGap: 0.2,
  /** Leading between wrapped title lines, as a fraction of title size. */
  titleLeading: 1.05,
  maxTitleLines: 2,
  /** Drop shadow so text still reads with overlay "none" over a bright photo. */
  shadowBlur: 0.035,
  shadowOffset: 0.008,
  shadowColor: 'rgba(0,0,0,0.45)',
} as const;

/** User-facing size nudge, since a long title on a 1400×250 strip needs room. */
export const TEXT_SCALES = [
  { id: 's', label: 'S', value: 0.82 },
  { id: 'm', label: 'M', value: 1 },
  { id: 'l', label: 'L', value: 1.22 },
] as const;

export type TextScaleId = (typeof TEXT_SCALES)[number]['id'];

export function textScaleValue(id: TextScaleId): number {
  return TEXT_SCALES.find((s) => s.id === id)?.value ?? 1;
}

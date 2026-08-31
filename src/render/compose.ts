import type { RGB } from '../image/averageColor';
import type { Rect, Size } from '../crop/geometry';
import { overlayById } from '../overlays';
import { drawText, type TextSpec } from './text';

export interface ComposeInput {
  bitmap: ImageBitmap;
  /** Crop rect in source-image pixels. */
  crop: Rect;
  /** Final pixel size of the banner. */
  out: Size;
  overlayId: string;
  avgColor: RGB;
  text: TextSpec;
}

/**
 * Cached image+overlay layer.
 *
 * Typing a title changes only glyphs, but redrawing from scratch would re-run a
 * high-quality resample of the whole crop plus a full-frame gradient fill on
 * every keystroke — tens of milliseconds once a freeform crop is tens of
 * megapixels. Everything below the text is therefore rendered once per
 * crop/size/overlay change and blitted 1:1 thereafter.
 *
 * Both preview and export go through it, so they remain pixel-identical by
 * construction rather than by coincidence.
 */
let baseCanvas: HTMLCanvasElement | null = null;
let baseBitmap: ImageBitmap | null = null;
let baseKey = '';

const baseLayerKey = ({ crop, out, overlayId, avgColor }: ComposeInput): string =>
  `${crop.x},${crop.y},${crop.w},${crop.h}|${out.width}x${out.height}` +
  `|${overlayId}|${avgColor.r},${avgColor.g},${avgColor.b}`;

function baseLayer(input: ComposeInput): HTMLCanvasElement | null {
  baseCanvas ??= document.createElement('canvas');
  const key = baseLayerKey(input);
  if (key === baseKey && input.bitmap === baseBitmap) return baseCanvas;

  const { bitmap, crop, out, overlayId, avgColor } = input;
  if (baseCanvas.width !== out.width) baseCanvas.width = out.width;
  if (baseCanvas.height !== out.height) baseCanvas.height = out.height;

  const ctx = baseCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
  overlayById(overlayId).draw(ctx, out.width, out.height, { avgColor });

  baseKey = key;
  baseBitmap = bitmap;
  return baseCanvas;
}

/** Drop the cached layer and its backing store (on reset / new upload). */
export function releaseBaseLayer(): void {
  if (baseCanvas) {
    baseCanvas.width = 0;
    baseCanvas.height = 0;
  }
  baseCanvas = null;
  baseBitmap = null;
  baseKey = '';
}

/**
 * The one and only draw path. Preview and download both go through this at the
 * FULL output resolution — the preview is that same canvas scaled down by CSS.
 * There is deliberately no second, smaller "preview renderer" to drift out of
 * sync with the exported file.
 */
export function compose(ctx: CanvasRenderingContext2D, input: ComposeInput): void {
  const { out, text } = input;
  ctx.clearRect(0, 0, out.width, out.height);
  const base = baseLayer(input);
  if (base) ctx.drawImage(base, 0, 0);
  drawText(ctx, out.width, out.height, text);
}

/** Size `canvas` to the output and compose into it. */
export function renderToCanvas(canvas: HTMLCanvasElement, input: ComposeInput): void {
  if (canvas.width !== input.out.width) canvas.width = input.out.width;
  if (canvas.height !== input.out.height) canvas.height = input.out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  compose(ctx, input);
}

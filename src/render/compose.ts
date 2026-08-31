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
 * The one and only draw path. Preview and download both go through this at the
 * FULL output resolution — the preview is that same canvas scaled down by CSS.
 * There is deliberately no second, smaller "preview renderer" to drift out of
 * sync with the exported file.
 */
export function compose(ctx: CanvasRenderingContext2D, input: ComposeInput): void {
  const { bitmap, crop, out, overlayId, avgColor, text } = input;

  ctx.clearRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);

  overlayById(overlayId).draw(ctx, out.width, out.height, { avgColor });
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

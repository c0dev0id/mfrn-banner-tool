import type { Rect, Size } from '../crop/geometry';
import type { RGB } from '../image/averageColor';

export interface OverlayContext {
  /** Average colour of the cropped region. */
  avgColor: RGB;
  /**
   * The source bitmap and the crop being rendered.
   *
   * An overlay that resamples the image — a blur, say — needs to read pixels
   * just *outside* the crop, which the already-drawn canvas cannot provide.
   */
  bitmap: ImageBitmap;
  crop: Rect;
  /** Bounds of the source bitmap, for clamping an expanded sample rect. */
  source: Size;
}

export interface Overlay {
  id: string;
  label: string;
  /** One-line explanation shown under the dropdown. */
  hint: string;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, c: OverlayContext): void;
}

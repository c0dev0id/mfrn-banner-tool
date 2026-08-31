import type { RGB } from '../image/averageColor';

export interface OverlayContext {
  /** Average colour of the cropped region. */
  avgColor: RGB;
}

export interface Overlay {
  id: string;
  label: string;
  /** One-line explanation shown under the dropdown. */
  hint: string;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, c: OverlayContext): void;
}

import { rgbaString } from '../image/averageColor';
import type { Overlay } from './types';

export type { Overlay, OverlayContext } from './types';

const none: Overlay = {
  id: 'none',
  label: 'None',
  hint: 'No overlay — the cropped image is used as-is.',
  draw() {},
};

const averageGradientTL: Overlay = {
  id: 'avg-gradient-tl',
  label: 'Average Colour Gradient — top left',
  hint: 'Fades the image’s own average colour from the top-left corner, making room for text.',
  draw(ctx, w, h, { avgColor }) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, rgbaString(avgColor, 1));
    g.addColorStop(1, rgbaString(avgColor, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};

/** Adding an overlay = one new object + one entry here. */
export const OVERLAYS: Overlay[] = [none, averageGradientTL];

export const DEFAULT_OVERLAY_ID = averageGradientTL.id;

export function overlayById(id: string): Overlay {
  return OVERLAYS.find((o) => o.id === id) ?? none;
}

import { averageGradientTL } from './averageGradient';
import { liquidGlassTL } from './liquidGlass';
import type { Overlay } from './types';

export type { Overlay, OverlayContext } from './types';
export { releaseGlassScratch } from './liquidGlass';

const none: Overlay = {
  id: 'none',
  label: 'None',
  hint: 'No overlay — the cropped image is used as-is.',
  draw() {},
};

/** Adding an overlay = one new file + one entry here. */
export const OVERLAYS: Overlay[] = [none, averageGradientTL, liquidGlassTL];

export const DEFAULT_OVERLAY_ID = averageGradientTL.id;

export function overlayById(id: string): Overlay {
  return OVERLAYS.find((o) => o.id === id) ?? none;
}

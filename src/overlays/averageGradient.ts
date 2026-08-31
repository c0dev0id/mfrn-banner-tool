import { rgbaString } from '../image/averageColor';
import { rampGradient } from './ramp';
import type { Overlay } from './types';

export const averageGradientTL: Overlay = {
  id: 'avg-gradient-tl',
  label: 'Average Colour Gradient — top left',
  hint: 'Fades the image’s own average colour from the top-left corner, making room for text.',
  draw(ctx, w, h, { avgColor }) {
    ctx.save();
    ctx.fillStyle = rampGradient(ctx, w, h, (a) => rgbaString(avgColor, a));
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};

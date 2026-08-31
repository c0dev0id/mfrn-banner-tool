import {
  BLUR_FRACTION,
  BLUR_LEVELS,
  BLUR_MIN,
  SATURATION,
  SCRIM_ALPHA,
  WORKING_RESOLUTION_CAP,
} from '../config/overlay';
import { RAMP_LENGTH } from '../config/overlay';
import {
  blurLevels,
  blurPadding,
  paddedSampleRect,
  supportsCanvasFilter,
  workingScale,
  type BlurLevel,
} from './blur';
import { rampGradient } from './ramp';
import type { Overlay, OverlayContext } from './types';

/** One scratch canvas, resized as needed, rather than four per render. */
let scratch: HTMLCanvasElement | null = null;

function scratchContext(width: number, height: number): CanvasRenderingContext2D | null {
  scratch ??= document.createElement('canvas');
  if (scratch.width !== width) scratch.width = width;
  if (scratch.height !== height) scratch.height = height;
  const ctx = scratch.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Free the scratch backing store; it can be large on a big crop. */
export function releaseGlassScratch(): void {
  if (scratch) {
    scratch.width = 0;
    scratch.height = 0;
  }
  scratch = null;
}

function drawLevel(
  ctx: CanvasRenderingContext2D,
  level: BlurLevel,
  width: number,
  height: number,
  scale: number,
  { bitmap, crop, source }: OverlayContext,
): void {
  const workW = Math.max(1, Math.round(width * scale));
  const workH = Math.max(1, Math.round(height * scale));
  const radiusWork = level.radius * scale;
  const pad = blurPadding(radiusWork);

  const sctx = scratchContext(workW + pad * 2, workH + pad * 2);
  if (!sctx) return;

  const { src, dest } = paddedSampleRect(crop, { width: workW, height: workH }, source, pad);
  if (src.w <= 0 || src.h <= 0) return;

  sctx.save();
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  // Saturation rides along in the same filter, so it is masked identically to
  // the blur and cannot leave a seam where the effect clears.
  sctx.filter = `blur(${radiusWork}px) saturate(${SATURATION})`;
  sctx.drawImage(bitmap, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
  sctx.filter = 'none';

  // Mask by this level's contribution curve. The ramp is defined in output
  // space, so its axis has to be mapped into the padded working canvas.
  const g = sctx.createLinearGradient(
    pad,
    pad,
    pad + width * RAMP_LENGTH * scale,
    pad + height * RAMP_LENGTH * scale,
  );
  for (const { offset, alpha } of level.stops) g.addColorStop(offset, `rgba(0, 0, 0, ${alpha})`);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, workW + pad * 2, workH + pad * 2);
  sctx.restore();

  // Composite the inner region back, scaling the working canvas up to output.
  ctx.drawImage(sctx.canvas, pad, pad, workW, workH, 0, 0, width, height);
}

export const liquidGlassTL: Overlay = {
  id: 'liquid-glass-tl',
  label: 'Liquid Glass — top left',
  hint: 'Progressively frosts the image from the top-left corner, clearing toward the bottom right.',
  draw(ctx, w, h, context) {
    const maxRadius = Math.max(BLUR_MIN, BLUR_FRACTION * Math.min(w, h));

    if (supportsCanvasFilter()) {
      const scale = workingScale({ width: w, height: h }, WORKING_RESOLUTION_CAP);
      // Increasing radius order: the strongest blur ends up on top at the
      // corner, and every mask has reached zero past the ramp.
      for (const level of blurLevels(maxRadius, BLUR_LEVELS)) {
        drawLevel(ctx, level, w, h, scale, context);
      }
    }

    // Always drawn, blur or not: blur removes detail but not luminance, so this
    // is what actually keeps a white title legible on a bright photo.
    ctx.save();
    ctx.fillStyle = rampGradient(ctx, w, h, (a) => `rgba(0, 0, 0, ${a * SCRIM_ALPHA})`);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};

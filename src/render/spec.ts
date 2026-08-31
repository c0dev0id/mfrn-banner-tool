import { textScaleValue } from '../config/style';
import type { Rect } from '../crop/geometry';
import { cropAverageColor } from '../image/averageColor';
import { outputSize, state } from '../state/editor';
import type { ComposeInput } from './compose';

/**
 * Editor state -> renderer input. Lives here rather than inside the preview
 * component so anything that needs a render (export, a second size, a headless
 * test) has an entry point without a component being mounted.
 */
export function composeInput(): ComposeInput | null {
  const src = state.source;
  if (!src) return null;
  const crop: Rect = { x: state.crop.x, y: state.crop.y, w: state.crop.w, h: state.crop.h };
  return {
    bitmap: src.bitmap,
    crop,
    out: outputSize(),
    overlayId: state.overlayId,
    avgColor: cropAverageColor(src.bitmap, crop),
    text: {
      title: state.title,
      subtitle: state.subtitle,
      scale: textScaleValue(state.textScale),
    },
  };
}

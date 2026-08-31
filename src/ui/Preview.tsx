import { createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { textScaleValue } from '../config/style';
import { averageColorOfCrop } from '../image/averageColor';
import { renderToCanvas } from '../render/compose';
import { outputSize, state } from '../state/editor';

interface Props {
  onCanvas: (canvas: HTMLCanvasElement) => void;
}

export default function Preview(props: Props) {
  let canvas!: HTMLCanvasElement;
  const [fontsReady, setFontsReady] = createSignal(false);

  onMount(() => {
    props.onCanvas(canvas);
    // Canvas bakes whatever font is resolved at draw time; without this gate the
    // first paint can silently use a fallback face.
    document.fonts.ready.then(() => setFontsReady(true));
  });

  const avgColor = createMemo(() => {
    const src = state.source;
    if (!src) return { r: 0, g: 0, b: 0 };
    return averageColorOfCrop(src.bitmap, state.crop);
  });

  createEffect(() => {
    const src = state.source;
    if (!src) return;
    fontsReady();
    renderToCanvas(canvas, {
      bitmap: src.bitmap,
      crop: { x: state.crop.x, y: state.crop.y, w: state.crop.w, h: state.crop.h },
      out: outputSize(),
      overlayId: state.overlayId,
      avgColor: avgColor(),
      text: {
        title: state.title,
        subtitle: state.subtitle,
        scale: textScaleValue(state.textScale),
      },
    });
  });

  // The canvas is at full export resolution; CSS scales it down. Preview and
  // download are therefore the exact same pixels.
  return <canvas ref={canvas} class="preview-canvas" />;
}

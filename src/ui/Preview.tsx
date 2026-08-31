import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { renderToCanvas } from '../render/compose';
import { composeInput } from '../render/spec';

export default function Preview() {
  let canvas!: HTMLCanvasElement;
  const [fontsReady, setFontsReady] = createSignal(false);

  onMount(() => {
    // Canvas bakes whatever font is resolved at draw time; without this gate the
    // first paint can silently use a fallback face.
    document.fonts.ready.then(() => setFontsReady(true));
  });

  // A full-resolution canvas can be hundreds of MB on a large freeform crop;
  // zeroing the dimensions is what actually frees the backing store.
  onCleanup(() => {
    canvas.width = 0;
    canvas.height = 0;
  });

  createEffect(() => {
    const input = composeInput();
    if (!input) return;
    fontsReady();
    renderToCanvas(canvas, input);
  });

  // The canvas is at full export resolution; CSS scales it down. Preview and
  // download are therefore the exact same pixels.
  return <canvas ref={canvas} class="preview-canvas" />;
}

import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { SourceImage } from '../image/decode';
import {
  fitView,
  moveRect,
  panView,
  rectToView,
  resizeRect,
  viewToImage,
  zoomAt,
  zoomTo,
  type Handle,
  type Point,
  type Rect,
  type Size,
  type View,
} from './geometry';

interface Props {
  source: SourceImage;
  crop: Rect;
  aspect: number | null;
  onCrop: (rect: Rect) => void;
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Drag =
  | { kind: 'move'; last: Point }
  | { kind: 'pan'; last: Point }
  | { kind: 'resize'; handle: Handle };

export default function CropStage(props: Props) {
  let container!: HTMLDivElement;
  let canvas!: HTMLCanvasElement;

  const [view, setView] = createSignal<View>({ scale: 1, tx: 0, ty: 0 });
  const [viewport, setViewport] = createSignal<Size>({ width: 0, height: 0 });

  let drag: Drag | null = null;
  const pointers = new Map<number, Point>();
  let pinchDistance = 0;
  /** Identity of the source we last auto-fitted, so we refit only on upload. */
  let fittedFor: ImageBitmap | null = null;

  const localPoint = (e: PointerEvent | WheelEvent): Point => {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const fitToViewport = () => {
    const vp = viewport();
    if (!vp.width || !vp.height) return;
    setView(fitView(props.source, vp));
  };

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
    });
    ro.observe(container);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), localPoint(e)));
    };
    // Non-passive so preventDefault actually stops the page from scrolling.
    container.addEventListener('wheel', onWheel, { passive: false });

    onCleanup(() => {
      ro.disconnect();
      container.removeEventListener('wheel', onWheel);
    });
  });

  // Auto-fit on a new upload, and once the viewport first has a size.
  createEffect(() => {
    const src = props.source;
    const vp = viewport();
    if (!vp.width || !vp.height) return;
    if (fittedFor === src.bitmap) return;
    fittedFor = src.bitmap;
    fitToViewport();
  });

  // Pointer/wheel events arrive faster than the screen refreshes (120-240 Hz
  // devices, and wheel bursts), so redrawing per event does 2-4x more full
  // resamples than can ever be shown. Coalesce to one per frame.
  let frame = 0;
  createEffect(() => {
    const v = view();
    const crop = { ...props.crop };
    const vp = viewport();
    const src = props.source;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw(v, crop, vp, src);
    });
  });

  onCleanup(() => {
    if (frame) cancelAnimationFrame(frame);
  });

  function draw(v: View, crop: Rect, vp: Size, src: SourceImage) {
    if (!vp.width || !vp.height) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(vp.width * dpr);
    const h = Math.round(vp.height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vp.width, vp.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src.bitmap, v.tx, v.ty, src.width * v.scale, src.height * v.scale);

    const c = rectToView(crop, v);

    // Dim everything outside the selection.
    ctx.fillStyle = 'rgba(9, 11, 15, 0.66)';
    ctx.fillRect(0, 0, vp.width, Math.max(0, c.y));
    ctx.fillRect(0, c.y + c.h, vp.width, Math.max(0, vp.height - (c.y + c.h)));
    ctx.fillRect(0, c.y, Math.max(0, c.x), c.h);
    ctx.fillRect(c.x + c.w, c.y, Math.max(0, vp.width - (c.x + c.w)), c.h);

    // Rule-of-thirds guides.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      const gx = Math.round(c.x + (c.w * i) / 3) + 0.5;
      const gy = Math.round(c.y + (c.h * i) / 3) + 0.5;
      ctx.moveTo(gx, c.y);
      ctx.lineTo(gx, c.y + c.h);
      ctx.moveTo(c.x, gy);
      ctx.lineTo(c.x + c.w, gy);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  }

  const frameStyle = () => {
    const c = rectToView(props.crop, view());
    return {
      left: `${c.x}px`,
      top: `${c.y}px`,
      width: `${c.w}px`,
      height: `${c.h}px`,
    };
  };

  function onPointerDown(e: PointerEvent) {
    container.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      drag = null;
      return;
    }

    const handle = (e.target as HTMLElement)?.dataset?.['handle'] as Handle | undefined;
    if (handle) {
      drag = { kind: 'resize', handle };
      return;
    }

    const c = rectToView(props.crop, view());
    const inside = p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    drag = inside ? { kind: 'move', last: p } : { kind: 'pan', last: p };
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.set(e.pointerId, p);

    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [Point, Point];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0 && dist > 0) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        setView((v) => zoomAt(v, dist / pinchDistance, mid));
      }
      pinchDistance = dist;
      return;
    }

    if (!drag) return;
    const v = view();

    if (drag.kind === 'resize') {
      props.onCrop(resizeRect(props.crop, drag.handle, viewToImage(p, v), props.aspect, props.source));
      return;
    }

    const dx = p.x - drag.last.x;
    const dy = p.y - drag.last.y;
    drag.last = p;

    if (drag.kind === 'move') {
      props.onCrop(moveRect(props.crop, dx / v.scale, dy / v.scale, props.source));
    } else {
      setView(panView(v, dx, dy));
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
    if (pointers.size === 0) drag = null;
    if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = (e.shiftKey ? 10 : 1) / view().scale;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = nudge[e.key];
    if (!delta) return;
    e.preventDefault();
    props.onCrop(moveRect(props.crop, delta[0], delta[1], props.source));
  }

  const viewportCentre = () => {
    const vp = viewport();
    return { x: vp.width / 2, y: vp.height / 2 };
  };

  const zoomBy = (factor: number) => setView((v) => zoomAt(v, factor, viewportCentre()));
  const zoomAbsolute = (scale: number) => setView((v) => zoomTo(v, scale, viewportCentre()));

  const zoomPercent = () => Math.round(view().scale * 100);

  return (
    <div class="cropper">
      <div
        class="cropper-stage"
        ref={container}
        tabindex="0"
        role="application"
        aria-label="Crop area. Drag to move, drag the handles to resize, arrow keys to nudge."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div class="crop-frame" style={frameStyle()}>
          <For each={HANDLES}>
            {(h) => <div class={`crop-handle crop-handle-${h}`} data-handle={h} />}
          </For>
        </div>
      </div>

      <div class="cropper-tools">
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
          −
        </button>
        <output class="zoom-readout">{zoomPercent()}%</output>
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={fitToViewport}>
          Fit
        </button>
        <button type="button" onClick={() => zoomAbsolute(1)}>
          100%
        </button>
        <span class="cropper-hint">Scroll to zoom · drag outside the frame to pan</span>
      </div>
    </div>
  );
}

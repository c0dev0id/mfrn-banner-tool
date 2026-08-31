export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Sample grid used for averaging — plenty for a representative colour. */
const SAMPLE = 48;

/**
 * Average colour over RGBA bytes.
 *
 * Averaged in (approximately) linear light via the root-mean-square of the
 * channel values. A naive mean of sRGB bytes drags mixed images toward a muddy
 * grey, which makes for a dull gradient.
 */
export function averageRGBA(data: Uint8ClampedArray): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    if (a === 0) continue;
    const cr = data[i]!;
    const cg = data[i + 1]!;
    const cb = data[i + 2]!;
    r += cr * cr * a;
    g += cg * cg * a;
    b += cb * cb * a;
    n += a;
  }
  if (n === 0) return { r: 0, g: 0, b: 0 };
  return {
    r: Math.round(Math.sqrt(r / n)),
    g: Math.round(Math.sqrt(g / n)),
    b: Math.round(Math.sqrt(b / n)),
  };
}

export function rgbaString({ r, g, b }: RGB, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Scratch canvas for sampling, allocated once. A fresh <canvas> plus 2D context
 * per call is a real backing-store allocation, and this runs on every crop
 * change.
 */
let scratch: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function sampler(): CanvasRenderingContext2D | null {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = SAMPLE;
    scratch.height = SAMPLE;
    scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  }
  return scratchCtx;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Average colour of a crop region of the source bitmap. */
export function averageColorOfCrop(bitmap: ImageBitmap, crop: CropRect): RGB {
  const ctx = sampler();
  if (!ctx) return { r: 0, g: 0, b: 0 };
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, SAMPLE, SAMPLE);
  return averageRGBA(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
}

/**
 * Cached form, keyed on the crop rect and bitmap. The average only changes when
 * the crop does, so overlay toggles and every keystroke reuse it.
 */
let cachedKey = '';
let cachedBitmap: ImageBitmap | null = null;
let cachedColor: RGB = { r: 0, g: 0, b: 0 };

export function cropAverageColor(bitmap: ImageBitmap, crop: CropRect): RGB {
  const key = `${crop.x},${crop.y},${crop.w},${crop.h}`;
  if (key === cachedKey && bitmap === cachedBitmap) return cachedColor;
  cachedColor = averageColorOfCrop(bitmap, crop);
  cachedKey = key;
  cachedBitmap = bitmap;
  return cachedColor;
}

/** Drop the cached colour so a closed ImageBitmap is not retained. */
export function releaseAverageColor(): void {
  cachedKey = '';
  cachedBitmap = null;
}

export interface SourceImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** Original filename, used to name the download. */
  name: string;
}

export class DecodeError extends Error {}

/** Hard ceiling so a 20000px scan doesn't wedge the tab. */
const MAX_DIMENSION = 12000;

const EXT_RE = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

/**
 * Browsers frequently hand us an empty or wrong `file.type` for HEIC, so sniff
 * the ISO-BMFF brand instead of trusting it.
 */
async function isHeic(file: File): Promise<boolean> {
  if (/heic|heif/i.test(file.type)) return true;
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  if (head.length < 12) return false;
  const ascii = String.fromCharCode(...head.subarray(4, 12));
  if (!ascii.startsWith('ftyp')) return false;
  return /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)/.test(ascii.slice(4));
}

export async function decodeImageFile(file: File): Promise<SourceImage> {
  // Sniffed once: each call re-reads the file header, and the two call sites
  // must agree.
  const heic = await isHeic(file);

  if (!EXT_RE.test(file.name) && !file.type.startsWith('image/') && !heic) {
    throw new DecodeError('That file does not look like an image. Use JPG, PNG, WebP or HEIC.');
  }

  let blob: Blob = file;

  if (heic) {
    try {
      // Lazy: the libheif WASM is ~1.5 MB and most uploads never need it.
      const { heicTo } = await import('heic-to');
      blob = await heicTo({ blob: file, type: 'image/png' });
    } catch (cause) {
      throw new DecodeError(
        'Could not read that HEIC file. Exporting it as JPEG from your phone usually works.',
        { cause },
      );
    }
  }

  let bitmap: ImageBitmap;
  try {
    // from-image applies the EXIF orientation, otherwise phone JPEGs land sideways.
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (cause) {
    throw new DecodeError('Could not decode that image — it may be corrupt.', { cause });
  }

  if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
    bitmap.close();
    throw new DecodeError(
      `That image is ${bitmap.width}×${bitmap.height}. Please scale it under ${MAX_DIMENSION}px first.`,
    );
  }

  return { bitmap, width: bitmap.width, height: bitmap.height, name: file.name };
}

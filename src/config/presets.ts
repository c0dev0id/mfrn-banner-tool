import type { Size } from '../crop/geometry';

export interface CropMode {
  /** Stable id used in state and the <select>. */
  id: string;
  label: string;
  /** Fixed output size in px. Absent for the two free modes. */
  width?: number;
  height?: number;
  /**
   * Omit on a fixed preset — the ratio is derived from width/height, so the
   * numbers are never written twice and cannot drift apart.
   *   null     -> freeform, both axes resize independently
   *   'source' -> lock to the uploaded image's own ratio
   *   number   -> lock to this w/h ratio
   */
  aspect?: null | 'source' | number;
}

/**
 * The single place to add a new target size. Order here is the order in the
 * dropdown.
 */
export const CROP_MODES: CropMode[] = [
  { id: 'original', label: 'Original — keep aspect ratio', aspect: 'source' },
  { id: 'free', label: 'Freeform — drag any edge', aspect: null },
  { id: 'avatar', label: '256 × 256 — Profile Picture', width: 256, height: 256 },
  { id: 'banner', label: '1400 × 250 — Profile Banner', width: 1400, height: 250 },
  { id: 'article', label: '1200 × 515 — Article Banner', width: 1200, height: 515 },
];

export const DEFAULT_MODE_ID = 'banner';

export function modeById(id: string): CropMode {
  return CROP_MODES.find((m) => m.id === id) ?? CROP_MODES[0]!;
}

/**
 * The fixed output size of a mode, or undefined when the user picks it.
 * The one place that knows how CropMode encodes "fixed vs free".
 */
export function presetSizeOf(mode: CropMode): Size | undefined {
  return mode.width !== undefined && mode.height !== undefined
    ? { width: mode.width, height: mode.height }
    : undefined;
}

/** The mode's aspect lock, derived from the fixed size when not stated. */
export function aspectOf(mode: CropMode): null | 'source' | number {
  if (mode.aspect !== undefined) return mode.aspect;
  const size = presetSizeOf(mode);
  return size ? size.width / size.height : null;
}

export interface CropMode {
  /** Stable id used in state and the <select>. */
  id: string;
  label: string;
  /** Fixed output size in px. Absent for the two free modes. */
  width?: number;
  height?: number;
  /**
   * null  -> freeform, the crop rect resizes on both axes independently
   * 'source' -> lock to the aspect ratio of the uploaded image
   * number -> lock to this w/h ratio
   */
  aspect: null | 'source' | number;
}

/**
 * The single place to add a new target size. Order here is the order in the
 * dropdown.
 */
export const CROP_MODES: CropMode[] = [
  { id: 'original', label: 'Original — keep aspect ratio', aspect: 'source' },
  { id: 'free', label: 'Freeform — drag any edge', aspect: null },
  { id: 'avatar', label: '256 × 256 — Profile Picture', width: 256, height: 256, aspect: 1 },
  { id: 'banner', label: '1400 × 250 — Profile Banner', width: 1400, height: 250, aspect: 1400 / 250 },
  { id: 'article', label: '1200 × 686 — Article Banner', width: 1200, height: 686, aspect: 1200 / 686 },
];

export const DEFAULT_MODE_ID = 'banner';

export function modeById(id: string): CropMode {
  return CROP_MODES.find((m) => m.id === id) ?? CROP_MODES[0]!;
}

/** True for the two modes whose output size the user may type in. */
export function hasFreeOutputSize(mode: CropMode): boolean {
  return mode.width === undefined;
}

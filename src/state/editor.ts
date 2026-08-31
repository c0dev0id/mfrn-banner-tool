import { createStore } from 'solid-js/store';
import { DEFAULT_MODE_ID, aspectOf, modeById, presetSizeOf } from '../config/presets';
import type { TextScaleId } from '../config/style';
import {
  fitAspectInside,
  outputSizeFor,
  resolveAspect,
  retargetAspect,
  sizeFromAxis,
  type Rect,
  type Size,
} from '../crop/geometry';
import { releaseAverageColor } from '../image/averageColor';
import { DecodeError, decodeImageFile, type SourceImage } from '../image/decode';
import { DEFAULT_OVERLAY_ID } from '../overlays';
import { releaseBaseLayer } from '../render/compose';

export type Stage = 'upload' | 'crop' | 'edit';

export interface EditorState {
  stage: Stage;
  source: SourceImage | null;
  modeId: string;
  crop: Rect;
  /** Explicit output size for Original/Freeform; null = native crop pixels. */
  manualSize: Size | null;
  overlayId: string;
  title: string;
  subtitle: string;
  textScale: TextScaleId;
  error: string | null;
  busy: boolean;
}

const EMPTY_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

const [state, setState] = createStore<EditorState>({
  stage: 'upload',
  source: null,
  modeId: DEFAULT_MODE_ID,
  crop: EMPTY_RECT,
  manualSize: null,
  overlayId: DEFAULT_OVERLAY_ID,
  title: '',
  subtitle: '',
  textScale: 'm',
  error: null,
  busy: false,
});

export { state };

export function currentMode() {
  return modeById(state.modeId);
}

export function currentAspect(): number | null {
  const src = state.source;
  if (!src) return null;
  return resolveAspect(aspectOf(currentMode()), src);
}

export function presetSize(): Size | undefined {
  return presetSizeOf(currentMode());
}

export function outputSize(): Size {
  return outputSizeFor(presetSize(), state.crop, state.manualSize);
}

export function canEditOutputSize(): boolean {
  return presetSize() === undefined;
}

/** Largest rect of the mode's aspect, centred on the whole image. */
function initialCrop(source: SourceImage, aspect: number | null): Rect {
  const full: Rect = { x: 0, y: 0, w: source.width, h: source.height };
  return aspect === null ? full : fitAspectInside(full, aspect);
}

export async function loadFile(file: File): Promise<void> {
  setState({ busy: true, error: null });
  try {
    const source = await decodeImageFile(file);
    state.source?.bitmap.close();
    releaseBaseLayer();
    releaseAverageColor();
    const aspect = resolveAspect(aspectOf(modeById(state.modeId)), source);
    setState({
      source,
      crop: initialCrop(source, aspect),
      manualSize: null,
      stage: 'crop',
      busy: false,
    });
  } catch (err) {
    const message =
      err instanceof DecodeError ? err.message : 'Something went wrong reading that file.';
    setState({ busy: false, error: message });
  }
}

export function setMode(modeId: string): void {
  const src = state.source;
  setState('modeId', modeId);
  setState('manualSize', null);
  if (!src) return;
  // The store already holds the new mode, so currentAspect() is the new lock.
  setState('crop', retargetAspect(state.crop, currentAspect(), src));
}

export function setCrop(crop: Rect): void {
  setState('crop', crop);
}

export function setManualSize(axis: 'width' | 'height', value: number): void {
  setState('manualSize', sizeFromAxis(axis, value, state.crop));
}

export function resetManualSize(): void {
  setState('manualSize', null);
}

export const setOverlay = (id: string) => setState('overlayId', id);
export const setTitle = (v: string) => setState('title', v);
export const setSubtitle = (v: string) => setState('subtitle', v);
export const setTextScale = (v: TextScaleId) => setState('textScale', v);
export const setStage = (stage: Stage) => setState('stage', stage);
export const clearError = () => setState('error', null);

export function reset(): void {
  state.source?.bitmap.close();
  releaseBaseLayer();
  releaseAverageColor();
  setState({
    stage: 'upload',
    source: null,
    crop: EMPTY_RECT,
    manualSize: null,
    title: '',
    subtitle: '',
    error: null,
    busy: false,
  });
}

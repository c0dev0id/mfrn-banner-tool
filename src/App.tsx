import { For, Show, createMemo, createSignal } from 'solid-js';
import CropStage from './crop/CropStage';
import { CROP_MODES } from './config/presets';
import { TEXT_SCALES, type TextScaleId } from './config/style';
import { needsUpscale, upscaleFactor } from './crop/geometry';
import { downloadCanvasAsPng } from './export/png';
import { OVERLAYS, overlayById } from './overlays';
import Dropzone from './ui/Dropzone';
import Preview from './ui/Preview';
import {
  canEditOutputSize,
  clearError,
  currentAspect,
  loadFile,
  outputSize,
  reset,
  resetManualSize,
  setCrop,
  setManualSize,
  setMode,
  setOverlay,
  setStage,
  setSubtitle,
  setTextScale,
  setTitle,
  state,
} from './state/editor';

export default function App() {
  let previewCanvas: HTMLCanvasElement | undefined;
  const [exporting, setExporting] = createSignal(false);

  const out = createMemo(() => outputSize());
  const upscale = createMemo(() => upscaleFactor(state.crop, out()));
  const warn = createMemo(() => needsUpscale(state.crop, out()));

  async function download() {
    if (!previewCanvas || !state.source) return;
    setExporting(true);
    try {
      await downloadCanvasAsPng(previewCanvas, state.source.name);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div class="app">
      <header class="app-header">
        <h1>Banner Tool</h1>
        <p>Crop, overlay and title an image for the forum.</p>
        <Show when={state.stage !== 'upload'}>
          <button type="button" class="ghost" onClick={reset}>
            Start over
          </button>
        </Show>
      </header>

      <Show when={state.stage === 'upload'}>
        <section class="panel">
          <Dropzone busy={state.busy} onFile={loadFile} />
          <Show when={state.error}>
            {(message) => (
              <p class="error" role="alert">
                {message()}
                <button type="button" class="link" onClick={clearError}>
                  dismiss
                </button>
              </p>
            )}
          </Show>
          <p class="note">
            Everything happens in your browser — the image is never uploaded anywhere.
          </p>
        </section>
      </Show>

      <Show when={state.stage === 'crop' && state.source}>
        {(source) => (
          <section class="stage-grid">
            <CropStage
              source={source()}
              crop={state.crop}
              aspect={currentAspect()}
              onCrop={setCrop}
            />

            <aside class="controls">
              <label class="field">
                <span>Target size</span>
                <select value={state.modeId} onChange={(e) => setMode(e.currentTarget.value)}>
                  <For each={CROP_MODES}>
                    {(mode) => <option value={mode.id}>{mode.label}</option>}
                  </For>
                </select>
              </label>

              <Show when={canEditOutputSize()}>
                <fieldset class="field size-fields">
                  <legend>Output size</legend>
                  <div class="size-row">
                    <label>
                      <span>Width</span>
                      <input
                        type="number"
                        min="1"
                        value={out().width}
                        onChange={(e) => setManualSize('width', e.currentTarget.valueAsNumber)}
                      />
                    </label>
                    <span class="times">×</span>
                    <label>
                      <span>Height</span>
                      <input
                        type="number"
                        min="1"
                        value={out().height}
                        onChange={(e) => setManualSize('height', e.currentTarget.valueAsNumber)}
                      />
                    </label>
                  </div>
                  <Show when={state.manualSize}>
                    <button type="button" class="link" onClick={resetManualSize}>
                      reset to native crop size
                    </button>
                  </Show>
                </fieldset>
              </Show>

              <dl class="readout">
                <div>
                  <dt>Selection</dt>
                  <dd>
                    {Math.round(state.crop.w)} × {Math.round(state.crop.h)} px
                  </dd>
                </div>
                <div>
                  <dt>Export</dt>
                  <dd>
                    {out().width} × {out().height} px
                  </dd>
                </div>
              </dl>

              <Show when={warn()}>
                <p class="warning" role="status">
                  Your selection is smaller than the target, so it will be upscaled{' '}
                  <strong>{upscale().toFixed(2)}×</strong> and lose sharpness. Zoom out and select a
                  larger area if you can.
                </p>
              </Show>

              <button type="button" class="primary" onClick={() => setStage('edit')}>
                Continue
              </button>
            </aside>
          </section>
        )}
      </Show>

      <Show when={state.stage === 'edit' && state.source}>
        <section class="stage-grid">
          <div class="preview-wrap">
            <Preview onCanvas={(c) => (previewCanvas = c)} />
            <p class="note">
              Preview at {out().width} × {out().height} px — the download is these exact pixels.
            </p>
          </div>

          <aside class="controls">
            <label class="field">
              <span>Overlay</span>
              <select value={state.overlayId} onChange={(e) => setOverlay(e.currentTarget.value)}>
                <For each={OVERLAYS}>
                  {(overlay) => <option value={overlay.id}>{overlay.label}</option>}
                </For>
              </select>
              <small>{overlayById(state.overlayId).hint}</small>
            </label>

            <label class="field">
              <span>Title</span>
              <input
                type="text"
                value={state.title}
                placeholder="Tracks, Pässe, POIs"
                onInput={(e) => setTitle(e.currentTarget.value)}
              />
            </label>

            <label class="field">
              <span>Subtitle</span>
              <input
                type="text"
                value={state.subtitle}
                placeholder="Information"
                onInput={(e) => setSubtitle(e.currentTarget.value)}
              />
            </label>

            <fieldset class="field">
              <legend>Text size</legend>
              <div class="segmented">
                <For each={TEXT_SCALES}>
                  {(scale) => (
                    <button
                      type="button"
                      classList={{ active: state.textScale === scale.id }}
                      onClick={() => setTextScale(scale.id as TextScaleId)}
                    >
                      {scale.label}
                    </button>
                  )}
                </For>
              </div>
            </fieldset>

            <div class="actions">
              <button type="button" class="ghost" onClick={() => setStage('crop')}>
                Back to crop
              </button>
              <button type="button" class="primary" onClick={download} disabled={exporting()}>
                {exporting() ? 'Preparing…' : 'Download PNG'}
              </button>
            </div>
          </aside>
        </section>
      </Show>
    </div>
  );
}

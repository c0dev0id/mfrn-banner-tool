# mfrn-banner-tool

Browser tool that turns a member's photo into a forum banner with a consistent
house look: crop to a target size, apply a computed overlay that makes room for
text, then set a title and subtitle.

Everything runs client-side. No image is ever uploaded anywhere.

## Flow

1. **Upload** — JPG, PNG, WebP or HEIC. Drag-drop, file picker or clipboard paste.
2. **Crop** — pick a target size; the frame locks to its aspect ratio. Pan, zoom
   (including past 1:1), drag any handle. A warning appears when the selection
   holds fewer pixels than the target, i.e. the export would be upscaled.
3. **Overlay** — choose a computed layer that creates space for text.
4. **Title & subtitle** — live preview, then download a PNG.

### Target sizes

| Option | Output |
| --- | --- |
| Original | native crop pixels, source aspect ratio |
| Freeform | native crop pixels, any shape |
| Profile Picture | 256 × 256 |
| Profile Banner | 1400 × 250 |
| Article Banner | 1200 × 686 |

Original and Freeform default to the crop's native pixel size and expose
aspect-locked width/height inputs for deliberate scaling.

### Overlays

| Option | Effect |
| --- | --- |
| None | image as cropped |
| Average Colour Gradient — top left | the image's own average colour, faded from the top-left corner (opaque) to the bottom-right (transparent) |

## Development

```sh
npm install
npm run dev        # http://localhost:5173/mfrn-banner-tool/
npm run typecheck
npm test
npm run build
```

## Where to change things

Typography and text placement are **not** user-facing controls — fixing them is
what keeps every generated banner recognisably ours. They live in one file:

- `src/config/style.ts` — font stack, weights, colours, margins, type scale, and
  `TEXT_ANCHOR` (`top-left` | `middle-left` | `bottom-left`).
- `src/config/presets.ts` — add a target size: one array entry.
- `src/overlays/` — add an overlay: one new object plus one entry in `OVERLAYS`.

### Brand font

The tool currently falls back to Arial Black. To use the real font, drop the
woff2 files into `public/fonts/`, uncomment the `@font-face` block at the top of
`src/styles.css`, and put the family name first in `TITLE_FONT` / `SUBTITLE_FONT`.

Canvas bakes whatever font is resolved at draw time, so the renderer waits on
`document.fonts.ready` before its first paint.

## Architecture notes

- **One render path.** `src/render/compose.ts` is the only place that draws a
  banner, and it always renders at the full output resolution. The preview is
  that same canvas scaled down with CSS, so the preview is byte-for-byte the
  file you download.
- **The crop rect lives in source-image coordinates**, so panning and zooming
  are purely presentational and can never disturb a crop you already set.
- **HEIC is lazy.** The libheif WASM decoder (~3 MB) is dynamically imported
  only when a HEIC file is actually dropped; it is not in the initial bundle.

## Deployment

Pushes to `main` (and, while the design is being iterated, `claude/**`) build and
publish to GitHub Pages via `.github/workflows/deploy.yml`.

**One-time setup:** repository *Settings → Pages → Build and deployment →
Source: **GitHub Actions***.

The Vite `base` is `/mfrn-banner-tool/`; override it with the `BASE_PATH`
environment variable if the repository is ever renamed.

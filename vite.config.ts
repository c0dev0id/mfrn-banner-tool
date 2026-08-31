import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// A relative base makes the build work wherever it is mounted: a custom domain
// root (https://shagen.me/), project pages (https://<user>.github.io/<repo>/),
// or a local `vite preview`. Absolute bases break the moment the mount point
// changes, which is what a hard-coded '/mfrn-banner-tool/' did.
// The app has no client-side routing, so relative URLs are unambiguous.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [solid()],
  // The only oversized chunk is the lazily-imported libheif WASM decoder,
  // which never reaches users who don't upload a HEIC.
  build: { target: 'es2022', chunkSizeWarningLimit: 3500 },
});

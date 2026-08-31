import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Project-pages hosting: https://<user>.github.io/mfrn-banner-tool/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/mfrn-banner-tool/',
  plugins: [solid()],
  // The only oversized chunk is the lazily-imported libheif WASM decoder,
  // which never reaches users who don't upload a HEIC.
  build: { target: 'es2022', chunkSizeWarningLimit: 3500 },
});

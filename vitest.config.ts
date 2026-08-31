import { defineConfig } from 'vitest/config';

// No solid plugin here on purpose: the test suite covers the pure modules
// (geometry, text layout, colour, filenames), which need no JSX transform.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

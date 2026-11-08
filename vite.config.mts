import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin proxy: server.js sends no Access-Control-Expose-Headers, so a cross-origin
    // fetch could not read Retry-After (server.js lines 9-16).
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  test: {
    // Pure modules (telemetry pipeline, reducers) must run without a DOM; UI tests opt in
    // with `// @vitest-environment jsdom` at the top of the file.
    environment: 'node',
  },
});

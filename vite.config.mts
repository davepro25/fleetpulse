import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Same origin on purpose: server.js doesn't expose Retry-After to cross-origin pages.
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  test: {
    // No DOM by default; UI tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
  },
});

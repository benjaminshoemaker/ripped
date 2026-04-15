/// <reference types="vitest" />
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
  },
  test: {
    // Vitest runs only the unit/integration tests under src/.
    // Playwright browser specs live under tests/*.spec.ts and are run via `npx playwright test`.
    include: ['src/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
});

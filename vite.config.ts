/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The page is served from https://007style.github.io/HDF-Plug/ (GitHub Pages), so every built file is under that folder.
export default defineConfig({
  plugins: [react()],
  base: '/HDF-Plug/',
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
});

import { defineConfig } from 'vite';

// Relative base so the built site works from any path, including the
// GitHub Pages project URL (https://<user>.github.io/Auto-Battler/).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Phaser alone is ~1.3 MB minified (~360 kB gzip); don't warn about it.
    chunkSizeWarningLimit: 1600,
  },
});

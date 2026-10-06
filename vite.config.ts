import { defineConfig } from 'vite';
export default defineConfig({
  // Relative assets work at both username.github.io/ and username.github.io/repo/.
  base: './',
  // Pre-bundle the lazy decoder so its first use does not reload the dev page and lose selected files.
  optimizeDeps: { include: ['@imagemagick/magick-wasm'] },
  server: { port: 3000, strictPort: true, watch: { ignored: ['**/artifacts/**','**/dist/**'] } },
  build: { rollupOptions: { output: { manualChunks: { spreadsheet: ['exceljs', 'jszip'] } } } },
});

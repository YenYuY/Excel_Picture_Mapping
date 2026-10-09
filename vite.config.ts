import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [{
    name: 'app-version',
    transformIndexHtml: html => html.replaceAll('%APP_VERSION%', version),
  }],
  // Relative assets work at both username.github.io/ and username.github.io/repo/.
  base: './',
  // Pre-bundle the lazy decoder so its first use does not reload the dev page and lose selected files.
  optimizeDeps: { include: ['@imagemagick/magick-wasm'] },
  server: { port: 3000, strictPort: true, watch: { ignored: ['**/artifacts/**','**/dist/**'] } },
  build: { rollupOptions: { output: { manualChunks: { spreadsheet: ['exceljs', 'jszip'] } } } },
});

import { defineConfig } from 'vite';
export default defineConfig({
  // Relative assets work at both username.github.io/ and username.github.io/repo/.
  base: './',
  server: { port: 3000, strictPort: true, watch: { ignored: ['**/artifacts/**','**/dist/**'] } },
  build: { rollupOptions: { output: { manualChunks: { spreadsheet: ['exceljs', 'jszip'] } } } },
});

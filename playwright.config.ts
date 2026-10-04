import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3000', channel: 'msedge', viewport: { width: 380, height: 900 } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1', url: 'http://127.0.0.1:3000', reuseExistingServer: true },
  outputDir: 'artifacts/browser',
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    { command: 'node tests/serve-nested.mjs', url: 'http://127.0.0.1:4175/health', reuseExistingServer: false },
  ],
});

import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node backend/scripts/start-memory.js',
      url: 'http://localhost:8080/api/health',
      reuseExistingServer: !isCI,
      cwd: '..',
      timeout: 60_000,
    },
    {
      command: 'npm --prefix frontend run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
      cwd: '..',
      timeout: 120_000,
    },
  ],
});


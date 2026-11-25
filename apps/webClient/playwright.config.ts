import { defineConfig, devices } from '@playwright/test';

/**
 * Two surfaces, two dev servers:
 *   - `app`     → Vite dev server (base "/" locally) on :5173, SPA routes.
 *   - `landing` → Astro dev server on :4321, marketing routes.
 * `home.spec.ts` covers the landing; every other spec stays on the SPA.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    /* Force English locale so i18n always renders English text in tests */
    locale: 'en-US',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'app',
      testIgnore: /home\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
    {
      name: 'landing',
      testMatch: /home\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4321' },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter frontend-web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter landing dev',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

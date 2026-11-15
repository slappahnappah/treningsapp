import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Mobilvisning i Chromium. Appen brukes mest på telefon.
const { defaultBrowserType: _ignored, ...phone } = devices['iPhone 14'];
// Noen utviklingsmiljøer har en ferdig installert nettleser. Ellers brukes den Playwright har lastet ned.
const local = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...phone,
    browserName: 'chromium',
    baseURL: 'http://localhost:4173',
    locale: 'nb-NO',
    timezoneId: 'Europe/Oslo',
    serviceWorkers: 'block',
    trace: 'off',
    ...(!process.env.CI && existsSync(local) ? { launchOptions: { executablePath: local } } : {}),
  },
  webServer: {
    // Testene kjører mot den bygde appen, slik den publiseres.
    command: 'npm run preview -w @stige/web -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});

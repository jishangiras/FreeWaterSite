// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Serve the dist/ folder before tests run */
  webServer: {
    command: 'npx serve dist -p 4321 -n',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },

  projects: [
    /* Desktop Chrome */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /*
     * Mobile — use a narrow viewport but keep mouse input (not hasTouch).
     * This exercises the ≤720px CSS breakpoints and the mobile bottom sheet
     * path without the quirks that full touch-device emulation introduces
     * in headless Chromium (form submit via page.click behaves differently).
     */
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: false, // keep mouse events; touch tested manually on device
      },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    // Signed-in session so the route guard (src/proxy.ts) lets tests reach app pages.
    // The API itself is mocked per test; auth.spec.ts clears this to test the guard.
    storageState: {
      cookies: [
        {
          name: 'ss_session',
          value: 'e2e-session',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/dashboard',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

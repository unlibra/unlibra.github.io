// The design tests (tests/*.spec.js): DESIGN.md's rules checked on the built page.
// `npm run test:e2e` builds the site and serves dist/ with `astro preview`, then runs
// Chromium against it. Playwright stops the server when the run ends.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4350;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test should fail, not pass on the second try.
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

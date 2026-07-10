import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: join("tests", "e2e", "specs"),
  globalSetup: join("tests", "e2e", "global-setup.ts"),
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  outputDir: join("test-results", "playwright"),
  reporter: [["line"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4187",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

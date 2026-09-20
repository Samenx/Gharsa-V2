import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/cleanup.js",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
});

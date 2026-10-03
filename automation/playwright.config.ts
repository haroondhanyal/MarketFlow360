import { defineBddConfig } from "playwright-bdd";
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { config as automationConfig } from "./config/env";

const root = resolve(import.meta.dirname, "..");
const webBase = automationConfig.webBaseUrl;
const apiBase = automationConfig.apiBaseUrl;
const databaseUrl = automationConfig.databaseUrl;
const bddDir = defineBddConfig({
  features: "bdd/features/**/*.feature",
  steps: ["bdd/steps/**/*.ts", "support/test.ts"],
  outputDir: ".features-gen",
});

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: Number(process.env.AUTOMATION_RETRIES ?? 1),
  workers: Number(process.env.AUTOMATION_WORKERS ?? 5),
  timeout: 45_000,
  expect: { timeout: 8_000 },
  globalSetup: "./global-setup.ts",
  reporter: [
    ["list"],
    ["allure-playwright", {
      resultsDir: "allure-results",
      detail: true,
      suiteTitle: "MarketFlow360 Automation",
      environmentInfo: {
        product: "MarketFlow360",
        webBaseUrl: webBase,
        apiBaseUrl: apiBase,
        browser: "Chromium",
      },
    }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webBase,
    storageState: ".state/owner.json",
    screenshot: "off",
    video: "on",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    headless: true,
  },
  projects: [
    { name: "ui", testMatch: "tests/ui/**/*.spec.ts" },
    { name: "api", testMatch: "tests/api/**/*.spec.ts", use: { video: "off" } },
    { name: "bdd", testDir: bddDir, testMatch: "**/*.spec.js" },
    { name: "database", testMatch: "tests/database/**/*.spec.ts", use: { video: "off" } },
  ],
  webServer: [
    {
      command: `./node_modules/.bin/nest start --watch`,
      cwd: resolve(root, "apps/api"),
      env: { DATABASE_URL: databaseUrl, PORT: new URL(apiBase).port, WEB_ORIGIN: webBase, SESSION_SECRET: process.env.SESSION_SECRET ?? "marketflow360-automation-only-session-secret", RESEND_API_KEY: "", NODE_ENV: "test" },
      url: `${apiBase}/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `./node_modules/.bin/next dev --hostname 127.0.0.1 --port ${new URL(webBase).port}`,
      cwd: resolve(root, "apps/web"),
      env: { NEXT_PUBLIC_API_URL: apiBase, WEB_ORIGIN: webBase, NODE_ENV: "development", MARKETFLOW_NEXT_DIST_DIR: ".next-automation" },
      url: webBase,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

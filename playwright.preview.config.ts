import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: /boot\.spec\.ts/,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:43124",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:43124",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

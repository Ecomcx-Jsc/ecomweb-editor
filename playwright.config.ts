import { defineConfig, devices } from "@playwright/test";

// E2E của trình soạn v2: chạy playground (Vite) rồi điều khiển bằng trình duyệt thật.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:5199", trace: "retain-on-failure", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] } }],
  webServer: { command: "npx vite --config playground/vite.config.ts", url: "http://localhost:5199", reuseExistingServer: true, timeout: 60_000 },
});

import { defineConfig, devices } from "@playwright/test";

// E2E của trình soạn v2: chạy playground (Vite) rồi điều khiển bằng trình duyệt thật.
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:5199", trace: "retain-on-failure", viewport: { width: 1440, height: 900 } },
  projects: [
    { name: "chromium", testIgnore: /perf\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] } },
    { name: "firefox", testIgnore: /perf\.spec/, use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", testIgnore: /perf\.spec/, use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    // Ma trận thiết bị (17/11): vỏ trình soạn phải dùng được ở mọi khổ — chỉ chạy devices.spec (bộ kiểm riêng cho khổ màn hình)
    { name: "phone-safari", testMatch: /devices\.spec/, use: { ...devices["iPhone 14"] } },
    { name: "phone-chrome", testMatch: /devices\.spec/, use: { ...devices["Pixel 7"] } },
    { name: "tablet-safari", testMatch: /devices\.spec/, use: { ...devices["iPad Mini"] } },
    { name: "tablet-chrome", testMatch: /devices\.spec/, use: { ...devices["Galaxy Tab S4"] } },
    { name: "laptop-small", testMatch: /devices\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "full-hd", testMatch: /devices\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "ultrawide", testMatch: /devices\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1080 } } },
    // Đo hiệu năng: chạy một mình sau khi các test khác xong (chạy chung thì tranh CPU, số đo sai)
    { name: "perf", testMatch: /perf\.spec/, dependencies: ["chromium", "firefox", "webkit"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: "npx vite --config playground/vite.config.ts", url: "http://localhost:5199", reuseExistingServer: true, timeout: 60_000 },
});

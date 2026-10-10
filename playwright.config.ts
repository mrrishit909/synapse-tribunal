import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run preview -- --port 4173",
    port: 4173,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
  // ENGINEERING_STANDARDS.md p.84: "Test in current Chromium, Firefox, and WebKit where
  // tooling is available. Document which actual environments were checked." All three
  // are installed and run here (see docs/TESTING.md for per-browser caveats, e.g. WebGL
  // availability differences in headless engines, handled by this project's own
  // supportsWebGL() feature-detection and fallback rather than assumed consistent).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});

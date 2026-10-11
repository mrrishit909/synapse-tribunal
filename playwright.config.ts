import { defineConfig, devices } from "@playwright/test";

// LIVE_URL runs the same suite against a deployed copy (e.g. the GitHub Pages site) instead
// of the local production preview. Tests navigate relative to it ("./"), so the trailing
// slash on the base path matters.
const LIVE_URL = process.env.LIVE_URL;
// PW_PORT moves the local preview off 4173 when another project on the machine is using it.
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  webServer: LIVE_URL
    ? undefined
    : {
        command: `npm run preview -- --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: true,
      },
  use: {
    baseURL: LIVE_URL ?? `http://localhost:${PORT}/synapse-tribunal/`,
  },
  // ENGINEERING_STANDARDS.md p.84: "Test in current Chromium, Firefox, and WebKit where
  // tooling is available. Document which actual environments were checked." All three
  // are installed and run here (see docs/TESTING.md for per-browser caveats, e.g. WebGL
  // availability differences in headless engines, handled by this project's own
  // supportsWebGL() feature-detection and fallback rather than assumed consistent).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Headless Firefox on Linux (CI) disables WebGL without a GPU, which made every WebGL-stage
    // test see the 2D fallback; force-enabled uses Mesa's software renderer, like WebKit already does.
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true } } },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});

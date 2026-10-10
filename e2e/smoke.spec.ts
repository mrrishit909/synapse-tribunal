import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file's own location, not the cwd a test runner happens to
// use, so this still writes inside the project's own verification/SCREENSHOTS/
// whether this file lives in templates/frontend/e2e/ (this repo) or in a
// cloned per-project repo's own e2e/ at its own root. This package is an ES
// module ("type": "module" in package.json), so __dirname isn't available.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "..", "verification", "SCREENSHOTS");

test("production preview renders and the counter works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /count is 0/i })).toBeVisible();
  await page.getByRole("button", { name: /count is 0/i }).click();
  await expect(page.getByRole("button", { name: /count is 1/i })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "template-smoke-desktop.png"), fullPage: true });
});

test.describe("responsive viewports", () => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ];
  for (const vp of viewports) {
    test(`renders at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByRole("button")).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `template-${vp.name}.png`), fullPage: true });
    });
  }
});

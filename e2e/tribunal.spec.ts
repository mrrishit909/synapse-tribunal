import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "..", "verification", "SCREENSHOTS");

test("vertical slice: case browser, perturbation, attribution, flip, reset", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("tribunal-scene")).toBeVisible();
  await expect(page.getByText(/PREDICTED:/)).toBeVisible();

  // Playwright's "visible" check does not treat opacity:0 as hidden, so an entrance
  // animation that leaves later panels transparent would still pass a bare
  // toBeVisible() assertion -- this caught a real bug (a 1.2s stagger left panels
  // 2-6 blank in an actual screenshot) that the functional assertions alone missed.
  await expect(async () => {
    const opacities = await page.locator(".dossier-panel").evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
    expect(opacities.every((o) => o === 1)).toBe(true);
  }).toPass({ timeout: 2000 });

  // SYN-INT-004: perturb an actionable feature, verify a real recompute happened.
  const probabilityBefore = await page.locator(".verdict-probability strong").first().textContent();
  const slider = page.getByLabel(/hours worked/i);
  await slider.fill("5");
  await expect(page.getByText(/recomputed live after your edit/i)).toBeVisible();
  const probabilityAfter = await page.locator(".verdict-probability strong").first().textContent();
  expect(probabilityAfter).not.toBe(probabilityBefore);

  // Feasible-flip search (the counterfactual mode folded into SYN-INT-004).
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(page.locator(".flip-result")).toBeVisible();

  // Reset returns to the unperturbed baseline.
  await page.getByRole("button", { name: /reset scenario/i }).click();
  await expect(page.getByText(/recomputed live after your edit/i)).toHaveCount(0);

  // Contradictory-case evidence is present (dossier-required scope).
  await expect(page.getByText(/contradictory case/i)).toBeVisible();

  // Immutable features never render an edit control.
  await expect(page.getByLabel(/^age$/i)).toHaveCount(0);
  await expect(page.getByLabel(/^sex$/i)).toHaveCount(0);

  expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "tribunal-desktop.png"), fullPage: true });
});

test("switching the selected case (SYN-INT-001) recomputes and clears perturbation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tribunal-scene")).toBeVisible();

  const caseNumberBefore = await page.locator(".dossier-case-number").textContent();
  const select = page.getByLabel(/test-set case/i);
  const options = await select.locator("option").all();
  const otherValue = await options[1].getAttribute("value");
  await select.selectOption(otherValue!);

  await expect(page.locator(".dossier-case-number")).not.toHaveText(caseNumberBefore ?? "");
});

test("keyboard operability: perturb and search without a mouse", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tribunal-scene")).toBeVisible();

  const slider = page.getByLabel(/hours worked/i);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/recomputed live after your edit/i)).toBeVisible();

  await page.getByRole("button", { name: /reset scenario/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/recomputed live after your edit/i)).toHaveCount(0);
});

test("reduced motion: scene renders immediately with no entrance animation to wait out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("tribunal-scene")).toBeVisible();
  // Panels must be at full opacity immediately, not mid-tween, when motion is reduced.
  const opacity = await page.locator(".dossier-panel").first().evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
});

test.describe("responsive viewports", () => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ];
  for (const vp of viewports) {
    test(`renders without horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.getByTestId("tribunal-scene")).toBeVisible();
      await expect(async () => {
        const opacities = await page.locator(".dossier-panel").evaluateAll((els) =>
          els.map((el) => Number(getComputedStyle(el).opacity)),
        );
        expect(opacities.every((o) => o === 1)).toBe(true);
      }).toPass({ timeout: 2000 });
      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `tribunal-${vp.name}.png`), fullPage: true });
    });
  }
});

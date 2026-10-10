// Real (non-headless, real-GPU) frame-pacing measurement for the WebGL stage, per
// docs/PERFORMANCE_BUDGETS.md: "SwiftShader (default headless software rendering)
// numbers are not trusted for this metric." Run with the production preview server up:
//   npx vite preview --port 4173 &
//   node verification/measure_frame_pacing.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:4173/");
await Promise.race([
  page.getByRole("button", { name: /skip intro/i }).waitFor({ state: "visible" }),
  page.getByTestId("tribunal-scene").waitFor({ state: "visible" }),
]);
const skip = page.getByRole("button", { name: /skip intro/i });
if (await skip.isVisible().catch(() => false)) await skip.click();
await page.getByTestId("webgl-stage").waitFor({ state: "visible" });

async function measureIdle(ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const samples = [];
        const start = performance.now();
        let last = start;
        function tick(t) {
          samples.push(t - last);
          last = t;
          if (t - start < duration) requestAnimationFrame(tick);
          else resolve(samples);
        }
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function measureDuringScroll(fromY, toY, ms) {
  const resultPromise = measureIdle(ms);
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const y = fromY + ((toY - fromY) * i) / steps;
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(ms / steps);
  }
  return resultPromise;
}

function summarize(samples) {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const fps = 1000 / mean;
  const dropped = samples.filter((s) => s > 1000 / 30).length; // frames slower than 30fps
  return { mean_ms: +mean.toFixed(2), p95_ms: +p95.toFixed(2), fps: +fps.toFixed(1), dropped_frames: dropped, n: samples.length };
}

const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

const idle = summarize(await measureIdle(1000));
const scrollForward = summarize(await measureDuringScroll(0, scrollHeight, 1500));
const scrollReverse = summarize(await measureDuringScroll(scrollHeight, 0, 1500));

const report = {
  measured_at: new Date().toISOString(),
  mode: "headed, real GPU (not headless/SwiftShader)",
  viewport: "1440x900",
  idle_baseline: idle,
  scroll_forward: scrollForward,
  scroll_reverse: scrollReverse,
  budget: "docs/PERFORMANCE_BUDGETS.md: ~60fps during active scroll, 0 dropped frames vs idle baseline",
};
writeFileSync("verification/FRAME_PACING.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();

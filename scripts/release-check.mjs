#!/usr/bin/env node
// Deterministic local release auditor. Actually RUNS every check rather than trusting
// committed claims -- per the project's own recurring lesson (REQUIREMENTS.yaml/README.md
// have each been caught stale at least once). Exits 0 only if every mandatory criterion
// passes; prints PASS/FAIL per line so the verdict is auditable, not a single opaque bit.
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(ROOT);

const results = [];
function run(label, cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "pipe", ...opts });
    results.push({ label, pass: true });
  } catch (err) {
    results.push({ label, pass: false, detail: String(err.stdout ?? err.message).slice(-2000) });
  }
}
function check(label, condition, detail) {
  results.push({ label, pass: !!condition, detail });
}

// --- Git working tree, checked FIRST ---
// Running the test suites below has a real side effect: Playwright regenerates its own
// screenshots on every run, which are tracked files -- checking "clean tree" AFTER running
// them would always fail on pixel-level run-to-run differences that have nothing to do
// with whether the COMMITTED state is clean. Checked here, before anything mutates
// tracked files, so this verifies the state actually being audited.
try {
  const status = execSync("git status --porcelain", { encoding: "utf-8" });
  check("git working tree is clean (checked before test runs)", status.trim() === "", status.trim() || undefined);
} catch (err) {
  check("git working tree is clean (checked before test runs)", false, String(err.message));
}

// --- Required documentation present ---
const REQUIRED_DOCS = [
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/VISUAL_DESIGN.md",
  "docs/MOTION_SYSTEM.md",
  "docs/DATA_SOURCES.md",
  "docs/TESTING.md",
  "docs/LIMITATIONS.md",
  "docs/DEPLOYMENT.md",
];
for (const doc of REQUIRED_DOCS) {
  check(`doc exists: ${doc}`, existsSync(join(ROOT, doc)));
}

// --- Requirements ledger: no mandatory P0 requirement left unstarted/blocked ---
const reqText = readFileSync(join(ROOT, "specifications/REQUIREMENTS.yaml"), "utf-8");
const badStatuses = [...reqText.matchAll(/^\s*status:\s*(unstarted|blocked)\s*$/gm)];
check(
  "no requirement/gate left unstarted or blocked",
  badStatuses.length === 0,
  badStatuses.length ? `${badStatuses.length} row(s) still unstarted/blocked` : undefined,
);

// --- Static analysis ---
run("typecheck (tsc -b)", "npx tsc -b");
run("lint (oxlint)", "npx oxlint");

// --- Unit/integration tests ---
run("vitest", "npx vitest run");
run(
  "pytest",
  `export SSL_CERT_FILE=$(.venv/bin/python -c "import certifi; print(certifi.where())") && .venv/bin/python -I -m pytest tests/unit -q`,
  { shell: "/bin/bash" },
);

// --- Production build ---
run("production build (vite build)", "npx vite build");

// --- Chunking invariant the WebGL error fallback depends on ---
// src/webgl/WebGLStage.tsx recognises WebGL failures by "webglstage" in the error's
// filename/stack. That only works while three's renderer is bundled INTO that chunk; a
// vendor split would make real renderer crashes unrecognisable. Pinned here so a config
// change can't break it silently.
try {
  const assets = join(ROOT, "dist", "assets");
  const chunks = execSync(`ls ${assets}`, { encoding: "utf-8" }).split("\n").filter((f) => f.endsWith(".js"));
  const withRenderer = chunks.filter((f) => readFileSync(join(assets, f), "utf-8").includes("THREE.WebGLRenderer"));
  check(
    "three's WebGLRenderer is bundled only in the WebGLStage chunk",
    withRenderer.length > 0 && withRenderer.every((f) => /^WebGLStage-/.test(f)),
    `chunks containing THREE.WebGLRenderer: ${withRenderer.join(", ") || "(none)"}`,
  );
} catch (err) {
  check("three's WebGLRenderer is bundled only in the WebGLStage chunk", false, String(err.message));
}

// --- E2E across all 3 browsers, including axe-core ---
try {
  execSync('pkill -f "vite preview"', { stdio: "ignore" });
} catch {
  /* no stray process, fine */
}
run("playwright (chromium + firefox + webkit, incl. axe-core)", "npx playwright test");

// --- Report ---
console.log("\n=== release:check ===\n");
let allPass = true;
for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label}`);
  if (!r.pass) {
    allPass = false;
    if (r.detail) console.log(`      ${r.detail.split("\n").slice(-10).join("\n      ")}`);
  }
}
console.log(`\n${allPass ? "PASS" : "FAIL"}  overall\n`);
process.exit(allPass ? 0 : 1);
